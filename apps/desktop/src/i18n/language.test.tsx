import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, translate, useLanguage, useT } from "./language";

function Sample() {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  return (
    <div>
      <p>{t("Back to the tools")}</p>
      <p>{t("{count} tools", { count: 26 })}</p>
      <button type="button" onClick={() => setLanguage(language === "en" ? "pt" : "en")}>
        switch
      </button>
    </div>
  );
}

describe("the translator", () => {
  beforeEach(() => localStorage.clear());

  it("starts in English, which needs no dictionary at all", () => {
    render(
      <LanguageProvider>
        <Sample />
      </LanguageProvider>,
    );
    expect(screen.getByText("Back to the tools")).toBeInTheDocument();
    expect(screen.getByText("26 tools")).toBeInTheDocument();
  });

  it("changes the interface, and remembers the choice", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <Sample />
      </LanguageProvider>,
    );

    await user.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByText("Voltar às ferramentas")).toBeInTheDocument();
    expect(screen.getByText("26 ferramentas")).toBeInTheDocument();
    expect(localStorage.getItem("tools4devs.language")).toBe("pt");
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("shows the English rather than a key when a string has no translation", () => {
    // What a half-finished dictionary does on screen decides whether a missing
    // string is a blemish or a broken interface.
    expect(translate("pt", "A sentence nobody has translated")).toBe(
      "A sentence nobody has translated",
    );
  });

  it("puts the values where the sentence wants them, not where English put them", () => {
    expect(translate("pt", "{name}, {count} running", { name: "Fila", count: 2 })).toBe(
      "Fila, 2 em execução",
    );
    // An unknown placeholder is left alone rather than printed as "undefined".
    expect(translate("en", "Hello {who}", {})).toBe("Hello {who}");
  });
});
