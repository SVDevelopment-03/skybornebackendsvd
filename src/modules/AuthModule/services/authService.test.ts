import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "./authService";
import TempUser from "../../UserModule/models/TempUser";
import User from "../../UserModule/models/User";
import { ConflictError } from "../../../handlers/httpError.handler";
import AccountDeletionRequest from "../../UserModule/models/AccountDeletionRequest";

test("emailSignup normalizes temp-user email casing before creating the account", async () => {
  const originalTempFindById = TempUser.findById;
  const originalTempFindByIdAndDelete = TempUser.findByIdAndDelete;
  const originalUserFindOne = User.findOne;
  const originalUserCreate = User.create;
  const originalDeletionRequestFindOne = AccountDeletionRequest.findOne;
  const originalDeletionRequestUpdateMany = AccountDeletionRequest.updateMany;

  try {
    TempUser.findById = (async () => ({
      _id: "temp-user-id",
      email: "NewUser@Example.com",
      otpVerified: true,
    })) as unknown as typeof TempUser.findById;

    TempUser.findByIdAndDelete = (async () => null) as typeof TempUser.findByIdAndDelete;

    AccountDeletionRequest.findOne = (() => ({
      sort: () => ({
        lean: async () => null,
      }),
    })) as unknown as typeof AccountDeletionRequest.findOne;
    AccountDeletionRequest.updateMany = (async () => ({ acknowledged: true })) as typeof AccountDeletionRequest.updateMany;

    User.findOne = (async () => null) as typeof User.findOne;

    let createdUser: any = null;
    User.create = (async (payload: Record<string, unknown>) => {
      createdUser = payload;
      return {
        _id: "new-user-id",
        ...payload,
      };
    }) as typeof User.create;

    const result = await AuthService.emailSignup({
      firstName: "Jane",
      lastName: "Doe",
      email: "newuser@example.com",
      password: "password123",
      tempUserId: "temp-user-id",
      phoneNumber: "+919999999999",
    } as any);

    assert.equal(result.user.email, "newuser@example.com");
    assert.equal(createdUser?.email, "newuser@example.com");
  } finally {
    TempUser.findById = originalTempFindById;
    TempUser.findByIdAndDelete = originalTempFindByIdAndDelete;
    User.findOne = originalUserFindOne;
    User.create = originalUserCreate;
    AccountDeletionRequest.findOne = originalDeletionRequestFindOne;
    AccountDeletionRequest.updateMany = originalDeletionRequestUpdateMany;
  }
});

test("emailSignup reactivates an inactive user when the same email is used again", async () => {
  const originalTempFindById = TempUser.findById;
  const originalTempFindByIdAndDelete = TempUser.findByIdAndDelete;
  const originalUserFindOne = User.findOne;
  const originalUserCreate = User.create;
  const originalDeletionRequestFindOne = AccountDeletionRequest.findOne;
  const originalDeletionRequestUpdateMany = AccountDeletionRequest.updateMany;

  try {
    TempUser.findById = (async () => ({
      _id: "temp-user-id",
      email: "newuser@example.com",
      otpVerified: true,
    })) as unknown as typeof TempUser.findById;

    TempUser.findByIdAndDelete = (async () => null) as typeof TempUser.findByIdAndDelete;

    AccountDeletionRequest.findOne = (() => ({
      sort: () => ({
        lean: async () => null,
      }),
    })) as unknown as typeof AccountDeletionRequest.findOne;
    AccountDeletionRequest.updateMany = (async () => ({ acknowledged: true })) as typeof AccountDeletionRequest.updateMany;

    const inactiveUser = {
      _id: "inactive-user-id",
      email: "deleted+inactive-user-id@remove.local",
      isActive: false,
      save: async function () {
        this.isActive = true;
        this.email = "newuser@example.com";
      },
    };

    User.findOne = (async () => inactiveUser) as typeof User.findOne;
    User.create = (async () => {
      throw new Error("create should not be called for reactivation");
    }) as typeof User.create;

    const result = await AuthService.emailSignup({
      firstName: "Jane",
      lastName: "Doe",
      email: "newuser@example.com",
      password: "password123",
      tempUserId: "temp-user-id",
      phoneNumber: "+919999999999",
    } as any);

    assert.equal(result.user.isActive, true);
    assert.equal(result.user.email, "newuser@example.com");
  } finally {
    TempUser.findById = originalTempFindById;
    TempUser.findByIdAndDelete = originalTempFindByIdAndDelete;
    User.findOne = originalUserFindOne;
    User.create = originalUserCreate;
    AccountDeletionRequest.findOne = originalDeletionRequestFindOne;
    AccountDeletionRequest.updateMany = originalDeletionRequestUpdateMany;
  }
});

test("emailSignup reactivates a user when a pending deletion request exists", async () => {
  const originalTempFindById = TempUser.findById;
  const originalTempFindByIdAndDelete = TempUser.findByIdAndDelete;
  const originalUserFindOne = User.findOne;
  const originalUserCreate = User.create;
  const originalDeletionRequestFindOne = AccountDeletionRequest.findOne;
  const originalDeletionRequestUpdateMany = AccountDeletionRequest.updateMany;

  try {
    TempUser.findById = (async () => ({
      _id: "temp-user-id",
      email: "newuser@example.com",
      otpVerified: true,
    })) as unknown as typeof TempUser.findById;

    TempUser.findByIdAndDelete = (async () => null) as typeof TempUser.findByIdAndDelete;

    const existingUser = {
      _id: "existing-user-id",
      email: "newuser@example.com",
      isActive: true,
      save: async function () {
        this.isActive = true;
      },
    };

    User.findOne = (async () => existingUser) as typeof User.findOne;
    User.create = (async () => {
      throw new Error("create should not be called when reactivating a pending deletion");
    }) as typeof User.create;
    AccountDeletionRequest.findOne = (() => ({
      sort: () => ({
        lean: async () => ({
          userId: "existing-user-id",
          status: "requested",
        }),
      }),
    })) as unknown as typeof AccountDeletionRequest.findOne;
    AccountDeletionRequest.updateMany = (async () => ({ acknowledged: true })) as typeof AccountDeletionRequest.updateMany;

    const result = await AuthService.emailSignup({
      firstName: "Jane",
      lastName: "Doe",
      email: "newuser@example.com",
      password: "password123",
      tempUserId: "temp-user-id",
      phoneNumber: "+919999999999",
    } as any);

    assert.equal(result.user.isActive, true);
    assert.equal(result.user.email, "newuser@example.com");
  } finally {
    TempUser.findById = originalTempFindById;
    TempUser.findByIdAndDelete = originalTempFindByIdAndDelete;
    User.findOne = originalUserFindOne;
    User.create = originalUserCreate;
    AccountDeletionRequest.findOne = originalDeletionRequestFindOne;
    AccountDeletionRequest.updateMany = originalDeletionRequestUpdateMany;
  }
});

test("emailSignup reactivates a user when duplicate key occurs during create", async () => {
  const originalTempFindById = TempUser.findById;
  const originalTempFindByIdAndDelete = TempUser.findByIdAndDelete;
  const originalUserFindOne = User.findOne;
  const originalUserCreate = User.create;
  const originalDeletionRequestFindOne = AccountDeletionRequest.findOne;
  const originalDeletionRequestUpdateMany = AccountDeletionRequest.updateMany;

  try {
    TempUser.findById = (async () => ({
      _id: "temp-user-id",
      email: "newuser@example.com",
      otpVerified: true,
    })) as unknown as typeof TempUser.findById;

    TempUser.findByIdAndDelete = (async () => null) as typeof TempUser.findByIdAndDelete;

    let lookupCount = 0;
    const duplicateUser = {
      _id: "duplicate-user-id",
      email: "newuser@example.com",
      isActive: false,
      save: async function () {
        this.isActive = true;
        this.email = "newuser@example.com";
      },
    };

    User.findOne = (async () => {
      lookupCount += 1;
      if (lookupCount === 1) {
        return null;
      }
      return duplicateUser;
    }) as typeof User.findOne;

    User.create = (async () => {
      const error = new Error("duplicate key error") as Error & { code?: number };
      error.code = 11000;
      throw error;
    }) as typeof User.create;

    AccountDeletionRequest.findOne = (() => ({
      sort: () => ({
        lean: async () => null,
      }),
    })) as unknown as typeof AccountDeletionRequest.findOne;
    AccountDeletionRequest.updateMany = (async () => ({ acknowledged: true })) as typeof AccountDeletionRequest.updateMany;

    const result = await AuthService.emailSignup({
      firstName: "Jane",
      lastName: "Doe",
      email: "newuser@example.com",
      password: "password123",
      tempUserId: "temp-user-id",
      phoneNumber: "+919999999999",
    } as any);

    assert.equal(result.user.isActive, true);
    assert.equal(result.user.email, "newuser@example.com");
  } finally {
    TempUser.findById = originalTempFindById;
    TempUser.findByIdAndDelete = originalTempFindByIdAndDelete;
    User.findOne = originalUserFindOne;
    User.create = originalUserCreate;
    AccountDeletionRequest.findOne = originalDeletionRequestFindOne;
    AccountDeletionRequest.updateMany = originalDeletionRequestUpdateMany;
  }
});

test("emailSignup returns a conflict error when a duplicate phone number already exists", async () => {
  const originalTempFindById = TempUser.findById;
  const originalUserFindOne = User.findOne;
  const originalUserCreate = User.create;
  const originalDeletionRequestFindOne = AccountDeletionRequest.findOne;
  const originalDeletionRequestUpdateMany = AccountDeletionRequest.updateMany;

  try {
    TempUser.findById = (async () => ({
      _id: "temp-user-id",
      email: "newuser@example.com",
      otpVerified: true,
    })) as unknown as typeof TempUser.findById;

    AccountDeletionRequest.findOne = (() => ({
      sort: () => ({
        lean: async () => null,
      }),
    })) as unknown as typeof AccountDeletionRequest.findOne;
    AccountDeletionRequest.updateMany = (async () => ({ acknowledged: true })) as typeof AccountDeletionRequest.updateMany;

    User.findOne = (async (query: any) => {
      if (query?.email) {
        return null;
      }
      return {
        _id: "existing-user-id",
        email: "other@example.com",
        phoneNumber: "+919999999999",
        isActive: true,
      };
    }) as typeof User.findOne;

    User.create = (async () => {
      const error = new Error("duplicate key error") as Error & { code?: number };
      error.code = 11000;
      throw error;
    }) as typeof User.create;

    await assert.rejects(
      () =>
        AuthService.emailSignup({
          firstName: "Jane",
          lastName: "Doe",
          email: "newuser@example.com",
          password: "password123",
          tempUserId: "temp-user-id",
          phoneNumber: "+919999999999",
        } as any),
      (error: unknown) => {
        assert.ok(error instanceof ConflictError);
        assert.equal(error.message, "User already exists");
        return true;
      },
    );
  } finally {
    TempUser.findById = originalTempFindById;
    User.findOne = originalUserFindOne;
    User.create = originalUserCreate;
    AccountDeletionRequest.findOne = originalDeletionRequestFindOne;
    AccountDeletionRequest.updateMany = originalDeletionRequestUpdateMany;
  }
});
