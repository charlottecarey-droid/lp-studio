import { describe, expect, it } from "vitest";
import { accountsWithoutHub } from "./partnerRoomAutocreate";

const acct = (key: string, sfdcId: string | null = null) => ({ key, name: key, signedDate: null, owner: null, sfdcId });

describe("accountsWithoutHub", () => {
  it("picks accounts never given a hub, or whose hub was deleted; skips live hubs and ones being made", () => {
    const list = [acct("a"), acct("b"), acct("c"), acct("d"), acct("e")];
    const known = [{ key: "b", pageId: 10 }, { key: "c", pageId: 11 }, { key: "d", pageId: -1 }, { key: "e", pageId: null }];
    expect(accountsWithoutHub(list, known, new Set([10])).map((a) => a.key)).toEqual(["a", "c", "e"]);
  });
  it("one hub per Salesforce account, whichever spelling comes first", () => {
    const list = [acct("innovate-32-services-llc", "001Po00000uO8MhIAK"), acct("innovate-32-services", "001Po00000uO8Mh")];
    expect(accountsWithoutHub(list, [], new Set()).map((a) => a.key)).toEqual(["innovate-32-services-llc"]);
  });
});
