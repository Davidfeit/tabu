type Variant = "primary" | "ghost" | "danger";

/**
 * כפתור צעצוע.
 *
 * העומק אינו קישוט: שפה תחתונה מלאה שהכפתור יורד אליה בלחיצה נותנת
 * משוב מגע ברור בלי אנימציה ובלי צבע נוסף — וזה בדיוק מה שילד מחפש
 * כשהוא לא בטוח אם הלחיצה נקלטה. הצורה חיה ב-CSS (.toy-btn), כדי שגם
 * כפתורים שאינם דרך הרכיב הזה ייראו אותו דבר.
 */
const STYLES: Record<Variant, string> = {
  primary: "toy-btn--primary",
  ghost: "",
  danger: "toy-btn--danger",
};

export function Button({
  variant = "ghost", className = "", ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`toy-btn text-[0.82rem] ${STYLES[variant]} ${className}`}
    />
  );
}
