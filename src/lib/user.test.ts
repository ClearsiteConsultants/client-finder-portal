import { createUser, deleteUser } from "./user";
import { prisma } from "./prisma";
import { compare } from "bcryptjs";

describe("User authentication helpers", () => {
  const testEmail = "test-auth@example.com";
  const testPassword = "TestPassword123!";

  afterEach(async () => {
    try {
      await deleteUser(testEmail);
    } catch {
      // User might not exist
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createUser", () => {
    it("should create a user with hashed password", async () => {
      const user = await createUser(testEmail, testPassword, "Test User");

      expect(user.email).toBe(testEmail);
      expect(user.name).toBe("Test User");
      expect(user.passwordHash).toBeTruthy();
      expect(user.passwordHash).not.toBe(testPassword);

      // Verify password is correctly hashed
      const isValid = await compare(testPassword, user.passwordHash!);
      expect(isValid).toBe(true);
    });

    it("should use email prefix as name if no name provided", async () => {
      const user = await createUser(testEmail, testPassword);

      expect(user.name).toBe("test-auth");
    });

    it("should not allow duplicate emails", async () => {
      await createUser(testEmail, testPassword);

      await expect(
        createUser(testEmail, testPassword)
      ).rejects.toThrow();
    });
  });

  describe("deleteUser", () => {
    it("should delete an existing user", async () => {
      await createUser(testEmail, testPassword);

      const deleted = await deleteUser(testEmail);
      expect(deleted.email).toBe(testEmail);

      const found = await prisma.user.findUnique({
        where: { email: testEmail },
      });
      expect(found).toBeNull();
    });

    it("should throw error when deleting non-existent user", async () => {
      await expect(
        deleteUser("nonexistent@example.com")
      ).rejects.toThrow();
    });
  });
});
