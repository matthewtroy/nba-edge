import { describe, expect, it } from "vitest";
import { playerLastName } from "../lib/player-last-name";

describe("playerLastName", () => {
  it("strips Jr and Jr.", () => {
    expect(playerLastName("Scotty Pippen Jr.")).toBe("Pippen");
    expect(playerLastName("Jaren Jackson Jr")).toBe("Jackson");
  });

  it("strips Sr and roman numerals", () => {
    expect(playerLastName("Ken Griffey Sr.")).toBe("Griffey");
    expect(playerLastName("Marcus Smart II")).toBe("Smart");
    expect(playerLastName("Robert Parish III")).toBe("Parish");
  });

  it("keeps normal names", () => {
    expect(playerLastName("Cam Spencer")).toBe("Spencer");
    expect(playerLastName("Zach Edey")).toBe("Edey");
  });
});