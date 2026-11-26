import {
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type GroupInfo,
} from "shared";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import type { GroupEntity } from "../entities/GroupEntity";
import {
  type GetGroupInfoBySlug,
  makeGetGroupInfoBySlug,
} from "./GetGroupInfoBySlug";

describe("GetGroupInfoBySlug", () => {
  let uow: InMemoryUnitOfWork;
  let getGroupInfoBySlug: GetGroupInfoBySlug;
  beforeEach(() => {
    uow = createInMemoryUow();
    const uowPerformer = new InMemoryUowPerformer(uow);
    getGroupInfoBySlug = makeGetGroupInfoBySlug({
      uowPerformer,
    });
  });

  const groupInfo: GroupInfo = {
    slug: "test-group-slug",
    options: {
      heroHeader: {
        title: "",
        description: "",
      },
    },
    name: "group",
  };

  const groupEntity: GroupEntity = {
    ...groupInfo,
    sirets: ["1234"],
  };

  describe("Wrong paths", () => {
    it("throws a not found error if the group slug is not found in gateway", async () => {
      uow.groupRepository.groupEntities = [groupEntity];
      expectPromiseToFailWithError(
        getGroupInfoBySlug.execute({
          groupSlug: "not-existing-slug",
        }),
        errors.establishmentGroup.missingBySlug({
          groupSlug: "not-existing-slug",
        }),
      );
    });
  });

  describe("Right paths", () => {
    it("returns the search result", async () => {
      uow.groupRepository.groupEntities = [groupEntity];
      expectToEqual(
        await getGroupInfoBySlug.execute({
          groupSlug: "test-group-slug",
        }),
        groupInfo,
      );
    });
  });
});
