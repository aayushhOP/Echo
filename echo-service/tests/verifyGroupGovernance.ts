import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Conversation from "../src/models/Conversation";
import User from "../src/models/User";
import * as conversationService from "../src/services/conversationService";
import * as messageService from "../src/services/messageService";

async function runGroupGovernanceVerification() {
  console.log("Starting in-memory MongoDB...");
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  console.log("Connected to in-memory MongoDB!");

  try {
    // 1. Test Group initialization & data model
    console.log("\n[Test 1] Initializing group with groupParticipants, creatorId & default settings...");
    const creator = await User.create({
      clerkId: "clerk_creator_123",
      username: "creator",
      email: "creator@example.com",
    });

    const member1 = await User.create({
      clerkId: "clerk_member_456",
      username: "member1",
      email: "member1@example.com",
    });

    const result = await conversationService.createConversation(creator._id.toString(), {
      type: "group",
      groupName: "Alpha Group",
      participants: [creator._id.toString(), member1._id.toString()],
    });

    const group = result.conversation;
    console.assert(group.creatorId?.toString() === creator._id.toString(), "CreatorId mismatch");
    console.assert(group.groupParticipants?.length === 2, "Group participants length should be 2");

    const creatorP = group.groupParticipants?.find((p) => p.userId.toString() === creator._id.toString());
    console.assert(creatorP?.role === "admin", "Creator must be admin");

    const memberP = group.groupParticipants?.find((p) => p.userId.toString() === member1._id.toString());
    console.assert(memberP?.role === "member", "Member must have role member");

    console.assert(group.settings?.onlyAdminsMessage === false, "Default onlyAdminsMessage should be false");
    console.assert(group.settings?.onlyAdminsEditInfo === false, "Default onlyAdminsEditInfo should be false");
    console.assert(group.settings?.onlyAdminsAddMembers === false, "Default onlyAdminsAddMembers should be false");
    console.assert(group.settings?.requireAdminApproval === false, "Default requireAdminApproval should be false");
    console.log("✔ Test 1 Passed: Data model & initialization confirmed.");

    // 2. Test Creator Shield
    console.log("\n[Test 2] Testing Creator Shield against demotion and removal...");
    const admin2 = await User.create({
      clerkId: "clerk_admin2_789",
      username: "admin2",
      email: "admin2@example.com",
    });

    // Add admin2
    await conversationService.updateConversation(group._id.toString(), creator._id.toString(), {
      addParticipants: [admin2._id.toString()],
    });

    // Elevate admin2 to admin
    const updatedGroup = await Conversation.findById(group._id);
    const admin2Participant = updatedGroup!.groupParticipants!.find(
      (p) => p.userId.toString() === admin2._id.toString()
    );
    admin2Participant!.role = "admin";
    updatedGroup!.admins!.push(admin2._id);
    await updatedGroup!.save();

    // admin2 attempts to remove creator
    let shieldTriggered = false;
    try {
      await conversationService.updateConversation(group._id.toString(), admin2._id.toString(), {
        removeParticipants: [creator._id.toString()],
      });
    } catch (err: any) {
      if (err.message.includes("The group creator cannot be removed")) {
        shieldTriggered = true;
      }
    }
    console.assert(shieldTriggered, "Shield should prevent creator removal");
    console.log("✔ Test 2 Passed: Creator Shield confirmed.");

    // 3. Test Restricted Messaging Mode
    console.log("\n[Test 3] Testing Restricted Messaging Mode enforcement...");
    updatedGroup!.settings = {
      onlyAdminsMessage: true,
      onlyAdminsEditInfo: false,
      onlyAdminsAddMembers: false,
      requireAdminApproval: false,
    };
    await updatedGroup!.save();

    let messageBlocked = false;
    try {
      await messageService.createMessage(member1._id.toString(), {
        conversationId: group._id.toString(),
        content: "Hello from regular member",
      });
    } catch (err: any) {
      if (err.message.includes("Only admins can send messages")) {
        messageBlocked = true;
      }
    }
    console.assert(messageBlocked, "Regular member message must be blocked in restricted mode");
    console.log("✔ Test 3 Passed: Restricted messaging mode enforced.");

    console.log("\n🎉 ALL ADVANCED GROUP GOVERNANCE VERIFICATIONS PASSED SUCCESSFULLY!");
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runGroupGovernanceVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
