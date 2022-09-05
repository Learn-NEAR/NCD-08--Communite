import { Worker, NearAccount } from "near-workspaces";
import anyTest, { TestFn } from "ava";

const test = anyTest as TestFn<{
  worker: Worker;
  accounts: Record<string, NearAccount>;
}>;

const defaultComplaint = {
  title: "bigcomplaint",
  description: "mega description",
  category: 0,
  location: "xd",
};

test.beforeEach(async (t) => {
  // Init the worker and start a Sandbox server
  const worker = await Worker.init();

  // Deploy contract
  const root = worker.rootAccount;
  const contract = await root.createSubAccount("test-account");
  // Get wasm file path from package.json test script in folder above
  await contract.deploy(process.argv[2]);
  // JavaScript contracts require calling 'init' function upon deployment
  await contract.call(contract, "init", {});

  // Save state for test runs, it is unique for each test
  t.context.worker = worker;
  t.context.accounts = { root, contract };
});

test.afterEach(async (t) => {
  // Stop Sandbox server
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

test("addNewComplaint#should run fine with good config", async (t) => {
  const { root, contract } = t.context.accounts;

  try {
    await root.call(contract, "addNewComplaint", defaultComplaint);
    t.pass();
  } catch {
    t.fail();
  }
});

test("addNewComplaint#should fail if we give an empty title", async (t) => {
  const { root, contract } = t.context.accounts;

  try {
    await root.call(contract, "addNewComplaint", {
      ...defaultComplaint,
      title: "",
    });
    t.fail();
  } catch {
    t.pass();
  }
});

test("addNewComplaint#should fail if we give an empty description", async (t) => {
  const { root, contract } = t.context.accounts;

  try {
    await root.call(contract, "addNewComplaint", {
      ...defaultComplaint,
      description: "",
    });
    t.fail();
  } catch {
    t.pass();
  }
});

test("addNewComplaint#should fail if we give too long of a description", async (t) => {
  const { root, contract } = t.context.accounts;

  try {
    await root.call(contract, "addNewComplaint", {
      ...defaultComplaint,
      description: "a".repeat(234),
    });
    t.fail();
  } catch {
    t.pass();
  }
});

test.only("voteComplaint#shoud run fine with proper index vote", async (t) => {
  const { root, contract } = t.context.accounts;

  await root.call(contract, "addNewComplaint", defaultComplaint);

  try {
    await contract.call(contract, "voteComplaint", { id: 0 });
    t.pass();
  } catch {
    t.fail();
  }
});

test("voteComplaint#shoud fail if we give an negative index", async (t) => {
  const { root, contract } = t.context.accounts;

  await root.call(contract, "addNewComplaint", defaultComplaint);

  try {
    await contract.call(contract, "voteComplaint", { id: -1 });
    t.fail();
  } catch {
    t.pass();
  }
});

test("voteComplaint#shoud fail if we give an index out of bounds", async (t) => {
  const { root, contract } = t.context.accounts;

  await root.call(contract, "addNewComplaint", defaultComplaint);

  try {
    await contract.call(contract, "voteComplaint", { id: 1 });
    t.fail();
  } catch {
    t.pass();
  }
});

test("voteComplaint#shoud fail if we already voted", async (t) => {
  const { root, contract } = t.context.accounts;

  await root.call(contract, "addNewComplaint", defaultComplaint);
  await contract.call(contract, "voteComplaint", { id: 0 });

  try {
    await contract.call(contract, "voteComplaint", { id: 0 });
    t.fail();
  } catch {
    t.pass();
  }
});

test("voteComplaint#shoud fail if the complaint is done", async (t) => {
  const { root, contract } = t.context.accounts;

  await root.call(contract, "addNewComplaint", defaultComplaint);

  const taker = await root.createSubAccount("taker");
  await taker.call(contract, "takeComplaint", { id: 0 });

  await root.call(contract, "finishComplaint", { id: 0 });

  try {
    await contract.call(contract, "voteComplaint", { id: 0 });
    t.fail();
  } catch {
    t.pass();
  }
});
