export * from './testGenerator';
export * from './edgeCaseDiscovery';
export * from './executionReporter';

import { TestGenerator } from './testGenerator';
import { EdgeCaseDiscovery } from './edgeCaseDiscovery';
import { ExecutionReporter } from './executionReporter';
import { logger } from '../../lib/logging';

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
        logger.info('Starting Intelligent Test Case Generation System...');
        
        const edgeCases = this.edgeCaseDiscovery.discoverEdgeCases(targetCode);
        logger.info('Discovered edge cases', { edgeCases });

        const testSuite = await this.testGenerator.generateTests(targetCode);
        logger.info('Generated test suite successfully.');

        const report = await this.executionReporter.executeTests(testSuite);
        const reportString = this.executionReporter.generateReport(report);
        logger.info(reportString);

        return reportString;
    }
}
