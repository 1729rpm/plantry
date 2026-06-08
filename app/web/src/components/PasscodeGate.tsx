import { useState, type FormEvent } from "react";

interface PasscodeGateProps {
  expected: string;
  onPass: () => void;
}

export function PasscodeGate({ expected, onPass }: PasscodeGateProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (value === expected) {
      setError(false);
      onPass();
    } else {
      setError(true);
    }
  }

  return (
    <div className="splash">
      <div className="splash__card">
        <h1 className="splash__title">Plantry</h1>
        <p className="splash__hint">Enter the household passcode to continue.</p>
        <form onSubmit={handleSubmit} className="splash__form">
          <input
            type="password"
            className="splash__input"
            placeholder="Passcode"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(false);
            }}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="splash__submit">
            Enter
          </button>
          {error && (
            <p className="splash__error" role="alert">
              That passcode is not right. Try again.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
