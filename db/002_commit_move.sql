-- טאבו — שכבת ההתחייבות
--
-- חוקי המשחק חיים ב-TypeScript (ראה docs/spec.md §3.0). כאן נמצא רק מה
-- שחייב להיות אטומי: עדכון מותנה + כתיבת אירועים + שידור, בטרנזקציה אחת.

-- ── שידור ────────────────────────────────────────────────────────────────
-- עוטף את realtime.send של Supabase. מקומית, בפיתוח ובטסטים, אין סכימת
-- realtime — ואז זו פעולה ריקה, כך שאותו SQL רץ בשני המקומות.
create or replace function public.tabu_broadcast(
  p_topic text, p_event text, p_payload jsonb
) returns void
language plpgsql
security definer set search_path = public as $$
begin
  if to_regnamespace('realtime') is not null then
    execute 'select realtime.send($1, $2, $3, $4)'
      using p_payload, p_event, p_topic, true;
  end if;
end $$;

-- ── ההתחייבות ────────────────────────────────────────────────────────────
--
-- נעילה אופטימית: העדכון מותנה בגרסה, ולכן שני כותבים מקבילים שקראו את
-- אותה גרסה מסתיימים באחד מוחל ואחד שמקבל STALE. אין TOCTOU — Postgres
-- מסדר אותם ברמת השורה. זו הסיבה שאין צורך לכתוב את חוקי המשחק ב-plpgsql.
--
-- p_events הוא מערך של {type, seat, payload}, בסדר שבו הם קרו.
create or replace function public.commit_move(
  p_room             uuid,
  p_expected_version bigint,
  p_state            jsonb,
  p_events           jsonb,
  p_actor            uuid,
  p_key              uuid
) returns jsonb
language plpgsql
security definer set search_path = public as $$
declare
  v_prior     jsonb;
  v_version   bigint;
  v_seq       bigint;
  v_event     jsonb;
  v_result    jsonb;
begin
  -- (1) אידמפוטנטיות: ניסיון חוזר מחזיר את התוצאה המקורית, לא מחיל שוב.
  select result into v_prior
    from game_action_intents
   where room_id = p_room and idempotency_key = p_key;
  if found then
    return v_prior || jsonb_build_object('replayed', true);
  end if;

  -- (2) העדכון המותנה. זו כל האטומיות.
  update game_state
     set state         = p_state,
         version       = version + 1,
         seq           = seq + coalesce(jsonb_array_length(p_events), 0),
         phase         = p_state ->> 'phase',
         current_seat  = (p_state ->> 'currentSeat')::smallint,
         turn_deadline = case
                           when p_state ->> 'turnDeadline' is null then null
                           else to_timestamp((p_state ->> 'turnDeadline')::bigint / 1000.0)
                         end,
         updated_at    = now()
   where room_id = p_room
     and version = p_expected_version
   returning version, seq into v_version, v_seq;

  if not found then
    -- או שהגרסה התיישנה, או שאין חדר כזה. מבחינים ביניהם כדי שהלקוח יידע
    -- אם לרענן ולנסות שוב, או להיכשל.
    select version into v_version from game_state where room_id = p_room;
    if v_version is null then
      return jsonb_build_object('ok', false, 'error', 'NO_ROOM');
    end if;
    return jsonb_build_object('ok', false, 'error', 'STALE', 'version', v_version);
  end if;

  -- (3) יומן האירועים. אותה טרנזקציה, ולכן לא יכול לסתור את המצב.
  for v_event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    insert into game_events (room_id, seq, actor_id, type, payload, version_after)
    values (
      p_room,
      (v_event ->> 'seq')::bigint,
      case when v_event ->> 'seat' is null then null else p_actor end,
      v_event ->> 'type',
      coalesce(v_event -> 'payload', '{}'::jsonb),
      v_version
    )
    on conflict (room_id, seq) do nothing;
  end loop;

  v_result := jsonb_build_object('ok', true, 'version', v_version, 'seq', v_seq);

  -- (4) השידור. באותה טרנזקציה כמו המהלך — rollback מבטל גם אותו.
  perform tabu_broadcast(
    'room:' || p_room::text,
    'move',
    jsonb_build_object('version', v_version, 'events', coalesce(p_events, '[]'::jsonb))
  );

  -- (5) רישום הכוונה, כדי שניסיון חוזר לא יחיל שוב.
  insert into game_action_intents (room_id, idempotency_key, user_id, result)
  values (p_room, p_key, p_actor, v_result)
  on conflict do nothing;

  return v_result;
end $$;

-- מקור האמת לטעינה ראשונית ולחיבור מחדש.
create or replace function public.get_game_state(p_room uuid)
returns jsonb
language sql
stable
security definer set search_path = public as $$
  select jsonb_build_object(
    'version', gs.version,
    'seq',     gs.seq,
    'state',   gs.state,
    -- מילישניות שלמות: הלקוח מתקן בהן סחיפת שעון מול הדדליין.
    'now',     (extract(epoch from now()) * 1000)::bigint
  )
  from game_state gs
  where gs.room_id = p_room;
$$;

-- אירועים שהוחמצו בזמן ניתוק. היומן שלנו מקיף יותר מ-Broadcast Replay
-- (שמוגבל ל-25 הודעות ול-72 שעות) ותקופת השמירה שלו בשליטתנו.
create or replace function public.get_events_since(p_room uuid, p_seq bigint)
returns setof public.game_events
language sql
stable
security definer set search_path = public as $$
  select * from game_events
   where room_id = p_room and seq > p_seq
   order by seq;
$$;
