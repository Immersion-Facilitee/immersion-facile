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

  const targetUser = new ConnectedUserBuilder()
    .withId("target-id")
    .withEmail("target@mail.com")
    .build();

  let updateUserPreventToDelete: UpdateUserPreventToDelete;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    const uowPerformer = new InMemoryUowPerformer(uow);
    updateUserPreventToDelete = makeUpdateUserPreventToDelete({
      uowPerformer,
    });
    uow.userRepository.users = [targetUser];
  });

  it("throws if user is not admin", async () => {
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

  it("sets preventToDelete to true", async () => {
    await updateUserPreventToDelete.execute(
      { userId: targetUser.id, preventToDelete: true },
      adminUser,
    );

    expectToEqual(uow.userRepository.users, [
      { ...targetUser, preventToDelete: true },
    ]);
  });

  it("unsets preventToDelete", async () => {
    uow.userRepository.users = [
      new ConnectedUserBuilder(targetUser).withPreventToDelete(true).build(),
    ];

    await updateUserPreventToDelete.execute(
      { userId: targetUser.id, preventToDelete: false },
      adminUser,
    );

    expectToEqual(uow.userRepository.users, [
      { ...targetUser, preventToDelete: undefined },
    ]);
  });
});
