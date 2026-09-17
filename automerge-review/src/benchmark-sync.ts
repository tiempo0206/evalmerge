import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { runSyncBenchmark } from "./benchmark.ts";

interface Arguments {
  output?: string;
  force: boolean;
}

function parseArguments(args: string[]): Arguments {
  const result: Arguments = { force: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--force") {
      result.force = true;
    } else if (argument === "--output") {
      const output = args[index + 1];
      if (!output) throw new Error("--output requires a path");
      result.output = output;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return result;
}

async function writeReport(
  outputArgument: string,
  report: ReturnType<typeof runSyncBenchmark>,
  force: boolean,
): Promise<string> {
  const output = resolve(outputArgument);
  const temporary = `${output}.${process.pid}.tmp`;
  await mkdir(dirname(output), { recursive: true });
  if (!force) {
    try {
      await access(output);
      throw new Error(
        `Output already exists: ${output}. Pass --force to replace it.`,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  try {
    await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
  return output;
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const report = runSyncBenchmark();
  console.table(report.results);
  console.log(JSON.stringify(report, null, 2));
  if (args.output) {
    console.log(
      `Output: ${await writeReport(args.output, report, args.force)}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
