import {
  SESSION_TYPE_LABELS,
  SESSION_TYPES,
  sessionTypeOf,
  type SessionMarks,
  type SessionType,
} from "@chalk/contracts";
import { NativeSelect } from "@chalk/ui/components/field.tsx";

/**
 * What the session was: a WOD class, a strength class, or Solo. Solo is the coaching's too, so
 * picking it fills "Coached by", and a class over Solo empties it.
 */
export function SessionTypeField({
  id,
  marks,
  onChange,
}: {
  /** For a form's `<Label htmlFor>`; the header field labels itself. */
  readonly id?: string;
  readonly marks: SessionMarks;
  readonly onChange: (type: SessionType | undefined) => void;
}) {
  return (
    <NativeSelect
      {...(id === undefined ? { "aria-label": "Session type", className: "w-40" } : { id })}
      value={sessionTypeOf(marks) ?? ""}
      onChange={(event) => onChange(SESSION_TYPES.find((type) => type === event.target.value))}
    >
      <option value="">Not recorded</option>
      {SESSION_TYPES.map((type) => (
        <option key={type} value={type}>
          {SESSION_TYPE_LABELS[type]}
        </option>
      ))}
    </NativeSelect>
  );
}
