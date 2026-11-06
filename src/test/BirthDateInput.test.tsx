import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { BirthDateInput as BirthDateInputPublica } from "@/components/publica/ui/BirthDateInput";
import { BirthDateInput as BirthDateInputCore } from "@/components/core/BirthDateInput";

describe("BirthDateInput (publica/ui)", () => {
  it("permite escribir el año dígito a dígito sin borrarlo", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    function Wrapper() {
      const [valor, setValor] = useState("");
      return (
        <BirthDateInputPublica
          id="test-fecha"
          valor={valor}
          onChange={(nuevo) => {
            setValor(nuevo);
            handleChange(nuevo);
          }}
        />
      );
    }

    render(<Wrapper />);

    const anioInput = screen.getByPlaceholderText("AAAA") as HTMLInputElement;
    expect(anioInput.value).toBe("");

    // Teclear 1er dígito
    await user.type(anioInput, "1");
    expect(anioInput.value).toBe("1");

    // Teclear 2do dígito
    await user.type(anioInput, "9");
    expect(anioInput.value).toBe("19");

    // Teclear 3er dígito
    await user.type(anioInput, "9");
    expect(anioInput.value).toBe("199");

    // Teclear 4to dígito
    await user.type(anioInput, "4");
    expect(anioInput.value).toBe("1994");
  });

  it("inicializa correctamente con un valor preexistente", () => {
    render(
      <BirthDateInputPublica
        id="test-fecha"
        valor="1990-08-25"
        onChange={() => {}}
      />
    );
    const anioInput = screen.getByPlaceholderText("AAAA") as HTMLInputElement;
    expect(anioInput.value).toBe("1990");
  });

  it("acepta tanto la prop 'disabled' como 'deshabilitado'", () => {
    const { unmount } = render(
      <BirthDateInputPublica
        id="test-fecha-disabled"
        valor="1990-08-25"
        disabled={true}
        onChange={() => {}}
      />
    );
    let anioInput = screen.getByPlaceholderText("AAAA") as HTMLInputElement;
    expect(anioInput).toBeDisabled();
    unmount();

    render(
      <BirthDateInputPublica
        id="test-fecha-deshabilitado"
        valor="1990-08-25"
        deshabilitado={true}
        onChange={() => {}}
      />
    );
    anioInput = screen.getByPlaceholderText("AAAA") as HTMLInputElement;
    expect(anioInput).toBeDisabled();
  });
});

describe("BirthDateInput (core)", () => {
  it("permite escribir el año dígito a dígito", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    function Wrapper() {
      const [valor, setValor] = useState("");
      return (
        <BirthDateInputCore
          value={valor}
          onChange={(nuevo) => {
            setValor(nuevo);
            handleChange(nuevo);
          }}
        />
      );
    }

    render(<Wrapper />);

    const anioInput = screen.getByPlaceholderText("Año") as HTMLInputElement;
    expect(anioInput.value).toBe("");

    await user.type(anioInput, "1");
    expect(anioInput.value).toBe("1");

    await user.type(anioInput, "9");
    expect(anioInput.value).toBe("19");

    await user.type(anioInput, "8");
    expect(anioInput.value).toBe("198");

    await user.type(anioInput, "5");
    expect(anioInput.value).toBe("1985");
  });
});
