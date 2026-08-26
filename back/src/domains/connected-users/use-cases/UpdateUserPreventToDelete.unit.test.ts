import {
  ConnectedUserBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import {
  makeUpdateUserPreventToDelete,
  type UpdateUserPreventToDelete,
} from "./UpdateUserPreventToDelete";

describe("UpdateUserPreventToDelete", () => {
  const randomUser = new ConnectedUserBuilder()
    .withId("not-admin-id")
    .withIsAdmin(false)
    .build();

  const adminUser = new ConnectedUserBuilder()
    .withId("admin-id")
    .withIsAdmin(true)
    .build();

  let updateUserPreventToDelete: UpdateUserPreventToDelete;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    const uowPerformer = new InMemoryUowPerformer(uow);
    updateUserPreventToDelete = makeUpdateUserPreventToDelete({
      uowPerformer,
    });
  });

  it("throws if user is not admin", async () => {
    const targetUser = new ConnectedUserBuilder()
      .withId("target-id")
      .withEmail("target@mail.com")
      .build();
    uow.userRepository.users = [targetUser];

    await expectPromiseToFailWithError(
      updateUserPreventToDelete.execute(
        { userId: targetUser.id, preventToDelete: true },
        randomUser,
      ),
      errors.user.forbidden({ userId: randomUser.id }),
    );
  });

  it("throws if target user is not found", async () => {
    await expectPromiseToFailWithError(
      updateUserPreventToDelete.execute(
        { userId: "unknown-id", preventToDelete: true },
        adminUser,
      ),
      errors.user.notFound({ userId: "unknown-id" }),
    );
  });

  it.each([
    { preventToDelete: true },
    { preventToDelete: false },
  ])("sets preventToDelete to $preventToDelete", async ({
    preventToDelete,
  }) => {
    const targetUser = new ConnectedUserBuilder()
      .withId("target-id")
      .withEmail("target@mail.com")
      .withPreventToDelete(!preventToDelete)
      .build();
    uow.userRepository.users = [targetUser];

    await updateUserPreventToDelete.execute(
      { userId: targetUser.id, preventToDelete: preventToDelete },
      adminUser,
    );

    expectToEqual(uow.userRepository.users, [
      { ...targetUser, preventToDelete: preventToDelete },
    ]);
  });
});
