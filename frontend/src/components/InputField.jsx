import { useId } from 'react'

/** Labelled input with inline error message and accessible wiring. */
export default function InputField({ label, error, hint, as = 'input', className = '', ...props }) {
  const id = useId()
  const Tag = as
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      <label htmlFor={id}>
        {label}
        {props.required && <span className="field__req" aria-hidden="true"> *</span>}
      </label>
      <Tag id={id} aria-invalid={!!error} aria-describedby={describedBy} {...props} />
      {error ? (
        <p id={`${id}-error`} className="field__error" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field__hint">{hint}</p>
      ) : null}
    </div>
  )
}
