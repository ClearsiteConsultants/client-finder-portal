import { prisma } from "./prisma";
import { hash } from "bcryptjs";

export async function createUser(email: string, password: string, name?: string) {
  const passwordHash = await hash(password, 10);

  return await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || email.split("@")[0],
    },
  });
}

export async function deleteUser(email: string) {
  return await prisma.user.delete({
    where: { email },
  });
}
