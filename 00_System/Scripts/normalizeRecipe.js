const { methodFromType, parseNamespace, slugFromOutputs } = require("./nameUtils");

const DEFAULT_MACHINE_BY_METHOD = {
  smelting: "minecraft:furnace",
  blasting: "minecraft:blast_furnace",
  smoking: "minecraft:smoker",
  campfire_cooking: "minecraft:campfire",
  stonecutting: "minecraft:stonecutter",
  shaped_crafting: "minecraft:crafting_table",
  shapeless_crafting: "minecraft:crafting_table",
  item_copying: "minecraft:crafting_table",
  smithing_transform: "minecraft:smithing_table",
  crushing: "create:crushing_wheel",
  item_application: "create:deployer",
  milling: "create:millstone",
  mixing: "create:mechanical_mixer",
  pressing: "create:mechanical_press",
  sandpaper_polishing: "create:sandpaper",
  cutting: "create:mechanical_saw",
  compacting: "create:mechanical_press",
  deploying: "create:deployer",
  emptying: "create:item_drain",
  filling: "create:spout",
  haunting: "create:encased_fan",
  mechanical_crafting: "create:mechanical_crafter",
  sequenced_assembly: "create:deployer",
  splashing: "create:encased_fan",
  toolbox_dyeing: "create:toolbox",
  enriching: "mekanism:enrichment_chamber",
  pulverizing: "thermal:pulverizer",
};

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizeMethod(type, json) {
  const typeMethod = methodFromType(type);
  const explicit = firstValue(json.method, json.process, json.processingType);
  if (explicit) {
    return String(explicit);
  }
  if (typeMethod === "shaped") {
    return "shaped_crafting";
  }
  if (typeMethod === "shapeless") {
    return "shapeless_crafting";
  }
  if (typeMethod === "crafting_shaped") {
    return "shaped_crafting";
  }
  if (typeMethod === "crafting_shapeless") {
    return "shapeless_crafting";
  }
  if (typeMethod.includes("pulverizer")) {
    return "pulverizing";
  }
  if (typeMethod.includes("enriching")) {
    return "enriching";
  }
  return typeMethod;
}

function normalizeIngredient(value, options = {}) {
  const role = options.role || "input";
  const inheritedCount = Number(options.count || 1);

  if (typeof value === "string") {
    return [
      {
        id: value,
        kind: "item",
        count: inheritedCount,
        role,
      },
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeIngredient(entry, { role, count: inheritedCount }));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const count = Number(firstValue(value.count, value.amount, value.quantity, inheritedCount) || 1);

  if (value.item || value.id) {
    return [
      {
        id: String(value.item || value.id),
        kind: value.fluid ? "fluid" : "item",
        count,
        role,
      },
    ];
  }

  if (value.tag) {
    return [
      {
        id: `#${String(value.tag).replace(/^#/, "")}`,
        kind: "tag",
        count,
        role,
      },
    ];
  }

  if (value.fluid) {
    return [
      {
        id: String(value.fluid),
        kind: "fluid",
        count,
        role,
      },
    ];
  }

  if (value.ingredient) {
    return normalizeIngredient(value.ingredient, { role, count });
  }

  if (value.ingredients) {
    return asArray(value.ingredients).flatMap((entry) => normalizeIngredient(entry, { role, count }));
  }

  return [];
}

function normalizeOutput(value, options = {}) {
  const role = options.role || "main_output";

  if (typeof value === "string") {
    return [
      {
        id: value,
        kind: "item",
        count: 1,
        chance: 1,
        role,
      },
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      normalizeOutput(entry, { role: index === 0 ? role : "byproduct" }),
    );
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const id = firstValue(value.item, value.id, value.result, value.fluid);
  if (typeof id === "object") {
    return normalizeOutput(id, { role });
  }
  if (!id) {
    return [];
  }

  return [
    {
      id: String(id),
      kind: value.fluid ? "fluid" : "item",
      count: Number(firstValue(value.count, value.amount, value.quantity, 1) || 1),
      chance: Number(firstValue(value.chance, value.probability, 1) || 1),
      role,
    },
  ];
}

function aggregateInputs(inputs) {
  const byKey = new Map();
  for (const input of inputs) {
    const key = `${input.kind}:${input.id}:${input.role}`;
    const current = byKey.get(key);
    if (current) {
      current.count += Number(input.count || 1);
    } else {
      byKey.set(key, { ...input, count: Number(input.count || 1) });
    }
  }
  return [...byKey.values()];
}

function normalizeShapedInputs(json) {
  const pattern = asArray(json.pattern);
  const key = json.key || {};
  const counts = {};

  for (const row of pattern) {
    for (const char of String(row)) {
      if (char !== " ") {
        counts[char] = (counts[char] || 0) + 1;
      }
    }
  }

  return Object.entries(counts).flatMap(([char, count]) =>
    normalizeIngredient(key[char], { count }),
  );
}

function collectGenericInputs(json) {
  const source = firstValue(
    json.ingredients,
    json.inputs,
    json.input,
    json.ingredient,
    json.itemInput,
  );
  return asArray(source).flatMap((entry) => normalizeIngredient(entry));
}

function collectGenericOutputs(json) {
  const outputs = firstValue(
    json.results,
    json.outputs,
    json.output,
    json.result,
    json.itemOutput,
  );
  return asArray(outputs).flatMap((entry, index) =>
    normalizeOutput(entry, { role: index === 0 ? "main_output" : "byproduct" }),
  );
}

function idFromSourcePath(sourcePath) {
  const match = String(sourcePath || "").match(/^data\/([^/]+)\/recipes?\/(.+)\.json$/i);
  if (!match) {
    return "";
  }
  return `${match[1]}:${match[2]}`;
}

function inferRecipeId(json, type, method, namespace, outputs) {
  if (json.id) {
    return String(json.id);
  }
  const sourceId = idFromSourcePath(json.__sourcePath);
  if (sourceId) {
    return sourceId;
  }
  const resultSlug = slugFromOutputs(outputs);
  return `${namespace}:${method}/${resultSlug}`;
}

function normalizeRecipe(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("normalizeRecipe expects one recipe object");
  }

  const type = String(firstValue(json.type, json.recipe_type, "unknown:unknown"));
  const method = normalizeMethod(type, json);
  const sourceId = idFromSourcePath(json.__sourcePath);
  const namespace = parseNamespace(firstValue(json.id, sourceId, type)).namespace;
  const mod = firstValue(json.mod, namespace);

  let inputs = [];
  if (method === "shaped_crafting") {
    inputs = normalizeShapedInputs(json);
  } else {
    inputs = collectGenericInputs(json);
  }

  const outputs = collectGenericOutputs(json);
  const status = inputs.length && outputs.length ? "auto" : "check";
  const machine = firstValue(
    json.machine,
    json.processingMachine,
    DEFAULT_MACHINE_BY_METHOD[method],
    `${mod}:unknown_machine`,
  );

  return {
    id: inferRecipeId(json, type, method, namespace, outputs),
    type,
    method,
    namespace,
    mod,
    machine: String(machine),
    stage: firstValue(json.stage, "unknown"),
    status,
    time: Number(firstValue(json.cookingtime, json.processingTime, json.time, json.duration, 0) || 0),
    energy: Number(firstValue(json.energy, json.fe, json.power, 0) || 0),
    inputs: aggregateInputs(inputs),
    outputs,
    raw: json,
  };
}

module.exports = {
  DEFAULT_MACHINE_BY_METHOD,
  normalizeIngredient,
  normalizeOutput,
  normalizeRecipe,
};
