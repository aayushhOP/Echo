import User, { IUser } from "../models/User";
import { clerkClient } from "../config/clerk";

/**
 * Resolves or auto-provisions a MongoDB user corresponding to a Clerk user ID.
 * If the user does not exist or has placeholder data (e.g. from missing webhooks in local dev),
 * it queries Clerk's API to fetch the user's actual username, email, and avatar.
 */
export const getOrProvisionUser = async (clerkUserId: string): Promise<IUser> => {
  let user = await User.findOne({ clerkId: clerkUserId });

  // If user does not exist or has placeholder data, fetch details from Clerk
  const hasPlaceholderData =
    !user ||
    user.email.endsWith("@placeholder.echo") ||
    user.username.startsWith("user_");

  if (hasPlaceholderData) {
    let email = `${clerkUserId}@placeholder.echo`;
    let username = `user_${clerkUserId.slice(-6)}`;
    let avatarUrl = "";

    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      if (clerkUser) {
        const primaryEmail =
          clerkUser.emailAddresses?.find(
            (e) => e.id === clerkUser.primaryEmailAddressId
          )?.emailAddress ||
          clerkUser.emailAddresses?.[0]?.emailAddress;

        if (primaryEmail) {
          email = primaryEmail.toLowerCase();
        }

        username =
          clerkUser.username ||
          (clerkUser.firstName && clerkUser.lastName
            ? `${clerkUser.firstName} ${clerkUser.lastName}`.trim()
            : clerkUser.firstName) ||
          (primaryEmail ? primaryEmail.split("@")[0] : `user_${clerkUserId.slice(-6)}`);

        avatarUrl = clerkUser.imageUrl || "";
      }
    } catch (err: any) {
      console.warn(
        `[getOrProvisionUser] Could not fetch details from Clerk for ${clerkUserId}:`,
        err.message || err
      );
    }

    if (!user) {
      user = await User.create({
        clerkId: clerkUserId,
        email,
        username,
        avatarUrl,
      });
    } else {
      // Upgrade existing placeholder record with actual details
      user.email = email;
      user.username = username;
      if (avatarUrl && !user.avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
      await user.save();
    }
  }

  if (!user) {
    throw new Error(`Failed to resolve or provision user for Clerk ID: ${clerkUserId}`);
  }

  return user;
};
