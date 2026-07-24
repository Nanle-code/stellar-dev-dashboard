export * from './testGenerator';
export * from './edgeCaseDiscovery';
export * from './executionReporter';

import { TestGenerator } from './testGenerator';
import { EdgeCaseDiscovery } from './edgeCaseDiscovery';
import { ExecutionReporter } from './executionReporter';

export class AITestSystem {
    private testGenerator: TestGenerator;
    private edgeCaseDiscovery: EdgeCaseDiscovery;
    private executionReporter: ExecutionReporter;

    constructor() {
        this.testGenerator = new TestGenerator();
        this.edgeCaseDiscovery = new EdgeCaseDiscovery();
        this.executionReporter = new ExecutionReporter();
    }

    public async runIntelligentTestGeneration(targetCode: string): Promise<string> {
        console.log('Starting Intelligent Test Case Generation System...');
        
        const edgeCases = this.edgeCaseDiscovery.discoverEdgeCases(targetCode);
        console.log('Discovered edge cases:', edgeCases);

        const testSuite = await this.testGenerator.generateTests(targetCode);
        console.log('Generated test suite successfully.');

        const report = await this.executionReporter.executeTests(testSuite);
        const reportString = this.executionReporter.generateReport(report);
        console.log(reportString);

        return reportString;
    }
}
