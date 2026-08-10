import type { DateTimeParts } from "../lib/date-time";

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function splitTime(value: string): { hour: string; minute: string } {
  const [hour = "18", minute = "30"] = value.split(":");
  return { hour, minute: MINUTES.includes(minute) ? minute : "00" };
}

export default function DateTimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: DateTimeParts;
  onChange: (value: DateTimeParts) => void;
}) {
  const { hour, minute } = splitTime(value.time);

  return (
    <fieldset className="fieldset-reset date-time-field">
      <legend>{label}</legend>
      <div className="date-time-field__controls">
        <div className="field">
          <label htmlFor={`${id}-date`}>日期</label>
          <input
            id={`${id}-date`}
            type="date"
            value={value.date}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-hour`}>時間（24 小時制）</label>
          <div className="time-selects">
            <select
              id={`${id}-hour`}
              aria-label={`${label}小時`}
              value={hour}
              onChange={(event) => onChange({ ...value, time: `${event.target.value}:${minute}` })}
            >
              {HOURS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span aria-hidden="true">:</span>
            <select
              id={`${id}-minute`}
              aria-label={`${label}分鐘`}
              value={minute}
              onChange={(event) => onChange({ ...value, time: `${hour}:${event.target.value}` })}
            >
              {MINUTES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </fieldset>
  );
}
