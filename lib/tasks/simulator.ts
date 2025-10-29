import type { TaskEventInput, TaskStatus } from './store';

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const baseSteps = [
  {
    key: 'PLAN',
    message: 'Mapping the high-level approach and resources required.',
    duration: [450, 900]
  },
  {
    key: 'RESEARCH',
    message: 'Reviewing prior runs and knowledge snippets.',
    duration: [600, 1200]
  },
  {
    key: 'DESIGN',
    message: 'Drafting structured plan, success metrics, and fallbacks.',
    duration: [700, 1400]
  },
  {
    key: 'EXECUTE',
    message: 'Simulating tool orchestration and intermediate verifications.',
    duration: [600, 1400]
  },
  {
    key: 'VERIFY',
    message: 'Running validation suite across simulated artifacts.',
    duration: [500, 1000]
  },
  {
    key: 'SUMMARIZE',
    message: 'Compiling final brief and suggested next steps.',
    duration: [400, 900]
  }
] as const;

const successOutro = [
  'Task complete. Delivering polished summary.',
  'Run concluded successfully. Highlights ready.',
  'Simulation succeeded. Presenting actionable wrap-up.'
];

const failureOutro = [
  'Encountered blocking issue during execution.',
  'Simulation aborted due to unmet dependency.',
  'Workflow failed integrity checks. Flagging follow-up.'
];

export async function runSimulatedTask(
  taskId: string,
  input: string,
  push: (event: TaskEventInput) => void
) {
  const hasNeedInput = Math.random() < 0.3;
  let needInputInjected = false;
  const totalSteps = baseSteps.length + (hasNeedInput ? 1 : 0);

  const emit = (event: TaskEventInput) => {
    push({ ...event, ts: Date.now() });
  };

  emit({ status: 'running', step: 'INITIALIZE', message: `Bootstrapping workflow for: ${input}` });
  await wait(randomBetween(250, 600));

  let processed = 1;
  for (const step of baseSteps) {
    if (hasNeedInput && !needInputInjected && processed > 1 && Math.random() < 0.5) {
      needInputInjected = true;
      emit({
        status: 'need_input',
        step: 'NEED_INPUT',
        message: 'Awaiting confirmation on inferred requirement.',
        progress: Math.min(0.85, processed / totalSteps)
      });

      await wait(randomBetween(900, 1400));

      emit({
        status: 'running',
        step: 'NEED_INPUT',
        message: 'Auto-resolved missing input using local context.',
        progress: Math.min(0.9, (processed + 0.25) / totalSteps)
      });

      await wait(randomBetween(400, 800));
    }

    emit({
      status: 'running',
      step: step.key,
      message: step.message,
      progress: Math.min(0.95, processed / totalSteps)
    });

    await wait(randomBetween(step.duration[0], step.duration[1]));
    processed += 1;
  }

  const succeeded = Math.random() > 0.12;
  const finalStatus: TaskStatus = succeeded ? 'succeeded' : 'failed';
  const outroPool = succeeded ? successOutro : failureOutro;
  const finalMessage = outroPool[Math.floor(Math.random() * outroPool.length)];

  emit({
    status: finalStatus,
    step: 'COMPLETE',
    message: finalMessage,
    progress: 1
  });
}
