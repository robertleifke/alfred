import { Dashboard } from "@/components/dashboard";
import { planAlfredScenario } from "@/lib/execution";
import { defaultScenario, demoScenarios } from "@/lib/scenarios";

export default async function Home() {
  const initialRun = await planAlfredScenario(defaultScenario);
  const scenarioOptions = demoScenarios.map(({ id, name }) => ({ id, name }));

  return <Dashboard initialRun={initialRun} scenarioOptions={scenarioOptions} />;
}
