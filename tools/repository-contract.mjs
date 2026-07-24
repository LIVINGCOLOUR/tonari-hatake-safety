import assert from "node:assert/strict";

export function exerciseRepositoryContract(repositories) {
  assert(repositories && typeof repositories === "object");

  assert.deepEqual(repositories.plans.list().map((item) => item.id), ["p1"]);
  assert.equal(repositories.plans.get("p1").name, "Plan 1");
  repositories.plans.save({ ...repositories.plans.get("p1"), name: "Updated plan" });
  repositories.plans.save({ id: "p2", name: "Plan 2", checks: {}, report: {} });
  assert.equal(repositories.plans.get("p1").name, "Updated plan");
  assert.equal(repositories.plans.get("p2").name, "Plan 2");

  assert.deepEqual(repositories.fields.list().map((item) => item.id), ["f1"]);
  repositories.fields.save({ id: "f2", name: "Field 2" });
  assert.equal(repositories.fields.get("f2").name, "Field 2");

  repositories.notifications.saveDelivery("p1", "f1", true);
  repositories.notifications.saveResponse("p1", "f1", "確認しました");
  assert.deepEqual(repositories.notifications.listByPlan("p1"), [{
    id: "p1:f1",
    planId: "p1",
    fieldId: "f1",
    delivered: true,
    response: "確認しました",
  }]);

  repositories.workRecords.save({
    planId: "p1",
    doneDate: "2026-07-23",
    actualAmount: "500mL/10a",
  });
  assert.equal(repositories.workRecords.get("p1").actualAmount, "500mL/10a");
  assert.equal(repositories.plans.get("p1").checks.report, true);

  assert.equal(repositories.fields.remove("f2").id, "f2");
  assert.equal(repositories.plans.remove("p2").id, "p2");
  assert.equal(repositories.fields.get("f2"), null);
  assert.equal(repositories.plans.get("p2"), null);

  return {
    plans: repositories.plans.list(),
    fields: repositories.fields.list(),
    notifications: repositories.notifications.listByPlan("p1"),
    workRecords: repositories.workRecords.list(),
  };
}
