import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { agent } from '../agent/agent';

export class Terminal {
  private rl: readline.Interface;
  private isRunning: boolean = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.bold.black('You: '),
    });
  }

  /**
   * Start the terminal interface
   */
  async start(): Promise<void> {
    this.isRunning = true;
    this.printWelcome();

    this.rl.prompt();

    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim();

      if (!trimmedInput) {
        this.rl.prompt();
        return;
      }

      // Handle commands
      if (trimmedInput.startsWith('/')) {
        await this.handleCommand(trimmedInput);
        this.rl.prompt();
        return;
      }

      // Process query
      try {
        await this.processQuery(trimmedInput);
      } catch (error: any) {
        console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
      }

      this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.printGoodbye();
      process.exit(0);
    });
  }

  /**
   * Process a user query
   */
  private async processQuery(query: string): Promise<void> {
    // Start loading spinner
    const spinner = ora({
      text: 'Thinking...',
      color: 'cyan',
      spinner: 'dots',
      discardStdin: false
    }).start();

    try {
      const response = await agent.processQuery(query);
      
      // Stop and clear spinner
      spinner.stop();
      spinner.clear();

      // Display reasoning first
      this.displayReasoning(response);

      // Display answer
      console.log(chalk.green('\nAgent: ' + this.wrapText(response.answer, 58)));

      // Display evaluation
      this.displayEvaluation(response);

    } catch (error: any) {
      spinner.stop();
      spinner.clear();
      throw error;
    }
  }

  /**
   * Display reasoning/routing decision
   */
  private displayReasoning(response: any): void {
    if (response.decision) {
      console.log(chalk.cyan('\n📋 Reasoning:'));
      console.log(chalk.gray(`  Decision: ${response.decision.decision === 'direct_llm' ? 'Direct LLM' : 'ReAct with Tools'}`));
      if (response.decision.reasoning) {
        console.log(chalk.gray(`  Reason: ${response.decision.reasoning}`));
      }
    }
  }

  /**
   * Display self-evaluation
   */
  private displayEvaluation(response: any): void {
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    
    // Display self-evaluation
    if (response.reflection) {
      console.log(chalk.cyan('\n🔍 Self-Evaluation:'));
      const scores = response.reflection.scores;
      
      console.log(chalk.gray('  Quality Scores:'));
      console.log(chalk.gray(`    Accuracy:     ${this.formatScore(scores.accuracy)}`));
      console.log(chalk.gray(`    Relevance:    ${this.formatScore(scores.relevance)}`));
      console.log(chalk.gray(`    Clarity:      ${this.formatScore(scores.clarity)}`));
      console.log(chalk.gray(`    Completeness: ${this.formatScore(scores.completeness)}`));
      
      const overallColor = scores.overallScore >= 0.75 ? chalk.green : chalk.yellow;
      console.log(overallColor(`    Overall:      ${(scores.overallScore * 100).toFixed(1)}%`));

      console.log(chalk.gray(`\n  Feedback: ${response.reflection.feedback}`));

      // Display improvement info if applicable
      if (response.improvementIterations && response.improvementIterations > 0) {
        console.log(chalk.yellow(`\n  ✨ Answer improved through ${response.improvementIterations} iteration(s)`));
      }
    }

    // Display response time
    console.log(chalk.gray(`\n⏱️  Response time: ${response.responseTime}ms`));
    console.log(chalk.gray('─'.repeat(60) + '\n'));
  }

  /**
   * Format score for display
   */
  private formatScore(score: number): string {
    const percentage = (score * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(score * 10));
    const empty = '░'.repeat(10 - Math.round(score * 10));

    let color = chalk.red;
    if (score >= 0.75) color = chalk.green;
    else if (score >= 0.5) color = chalk.yellow;

    return color(`${bar}${empty} ${percentage}%`);
  }

  /**
   * Handle special commands
   */
  private async handleCommand(command: string): Promise<void> {
    const cmd = command.toLowerCase();

    switch (cmd) {
      case '/help':
        this.printHelp();
        break;

      case '/describe':
        console.log(chalk.cyan('\n' + agent.getDescription() + '\n'));
        break;


      case '/exit':
      case '/quit':
        this.rl.close();
        break;

      default:
        console.log(chalk.red(`\n❌ Unknown command: ${command}`));
        console.log(chalk.gray('Type /help to see available commands\n'));
        break;
    }
  }

  /**
   * Print welcome message
   */
  private printWelcome(): void {
    console.clear();
    console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║                    REACT AGENT                            ║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════╝\n'));
    
    console.log(chalk.white('Welcome to the ReAct Agent!'));
    console.log(chalk.gray('A simple agent that uses tools to answer questions.\n'));
    
    console.log(chalk.yellow('Quick Commands:'));
    console.log(chalk.gray('  /help     - Show all commands'));
    console.log(chalk.gray('  /describe - Agent description'));
    console.log(chalk.gray('  /exit     - Exit agent\n'));
    
    console.log(chalk.green('Type your question and press Enter.\n'));
  }

  /**
   * Print help message
   */
  private printHelp(): void {
    console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║                    AVAILABLE COMMANDS                    ║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝\n'));
    
    const commands = [
      { cmd: '/help', desc: 'Show this help message' },
      { cmd: '/describe', desc: 'Show agent capabilities and description' },
      { cmd: '/exit or /quit', desc: 'Exit the agent' },
    ];

    commands.forEach(({ cmd, desc }) => {
      console.log(chalk.yellow(`  ${cmd.padEnd(20)}`), chalk.gray(desc));
    });

    console.log(chalk.cyan('\n' + '─'.repeat(60) + '\n'));
    console.log(chalk.white('Usage:'));
    console.log(chalk.gray('  • Type any question to get an answer'));
    console.log(chalk.gray('  • The agent will use tools to help answer your question\n'));
  }

  /**
   * Print goodbye message
   */
  private printGoodbye(): void {
    console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║                      GOODBYE!                            ║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝\n'));
    
    console.log(chalk.green('Thank you for using the ReAct Agent!\n'));
  }

  /**
   * Wrap text to fit terminal width
   */
  private wrapText(text: string, width: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + word).length <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }

  /**
   * Stop the terminal interface
   */
  stop(): void {
    this.isRunning = false;
    this.rl.close();
  }
}

