import { removeServerDefinition, serverExists } from "../utils/server-store.js";

export async function serverRemoveCommand(name: string): Promise<void> {
  if (!serverExists(name)) {
    console.error(`Error: Server "${name}" does not exist in central repository.`);
    process.exitCode = 1;
    return;
  }

  await removeServerDefinition(name);
  console.log(`Server "${name}" removed from central repository.`);
}
