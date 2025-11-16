import { lmStudioClient } from '../clients/lmstudio-client';
import { createComponentLogger } from '../utils/logger';
import chalk from 'chalk';

const logger = createComponentLogger('ReflectionService');

export interface ReflectionScores {
    accuracy: number; // 0-1
    relevance: number; // 0-1
    clarity: number; // 0-1
    completeness: number; // 0-1
    overallScore: number; // 0-1
}

export interface ReflectionResult {
    scores: ReflectionScores;
    feedback: string;
    shouldImprove: boolean;
    improvementSuggestions?: string;
}

/**
 * Reflection Service
 * Evaluates agent responses for quality and provides improvement suggestions
 */
export class ReflectionService {
    private qualityThreshold: number = 0.75; // Minimum acceptable score

    constructor() {
        logger.info('Reflection service initialized', {
            qualityThreshold: this.qualityThreshold,
        });
    }

    /**
     * Evaluate the quality of an agent's answer
     */
    async evaluateAnswer(
        userQuestion: string,
        agentAnswer: string
    ): Promise<ReflectionResult> {
        const startTime = Date.now();

        logger.info('Starting answer evaluation', {
            questionLength: userQuestion.length,
            answerLength: agentAnswer.length,
        });

        try {
            const prompt = `You are an expert evaluator assessing the quality of an AI agent's response.

USER QUESTION:
"${userQuestion}"

AGENT ANSWER:
"${agentAnswer}"

Evaluate the answer on these dimensions (score 0.0 to 1.0 for each):

1. **Accuracy**: Is the information correct and factual? Consider:
   - Are facts correct?
   - Are there any false claims?
   - Is technical information accurate?
   Score: 1.0 = perfect accuracy, 0.5 = some errors, 0.0 = completely wrong

2. **Relevance**: Does it directly address the user's question? Consider:
   - Does it answer what was asked?
   - Is the information on-topic?
   - Does it avoid unnecessary tangents?
   Score: 1.0 = perfectly relevant, 0.5 = partially relevant, 0.0 = off-topic

3. **Clarity**: Is it clear, well-structured, and easy to understand? Consider:
   - Is the language clear?
   - Is it well-organized?
   - Is it easy to follow?
   Score: 1.0 = crystal clear, 0.5 = somewhat confusing, 0.0 = incomprehensible

4. **Completeness**: Does it fully answer the question without missing key points? Consider:
   - Are all aspects of the question addressed?
   - Is sufficient detail provided?
   - Are there obvious gaps?
   Score: 1.0 = comprehensive, 0.5 = partial answer, 0.0 = missing everything

CRITICAL: Provide your evaluation in PURE JSON format (no markdown, no code blocks, no extra text).
Return ONLY this JSON structure:
{
  "accuracy": 0.85,
  "relevance": 0.90,
  "clarity": 0.75,
  "completeness": 0.80,
  "feedback": "Brief explanation of the evaluation",
  "improvementSuggestions": "Specific suggestions if any score < 0.75, otherwise null"
}

Be objective and use the full 0.0-1.0 range. Most answers should be between 0.6-0.9.`;

            const response = await lmStudioClient.chatCompletion(
                [{ role: 'user', content: prompt }],
                { temperature: 0.3, maxTokens: 800 }
            );

            // Clean and parse JSON response
            let cleanedResponse = response.trim();

            // Remove markdown code blocks if present
            if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }

            // Extract JSON if there's extra text
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanedResponse = jsonMatch[0];
            }

            const evaluation = JSON.parse(cleanedResponse);

            // Calculate overall score
            const overallScore = (
                evaluation.accuracy +
                evaluation.relevance +
                evaluation.clarity +
                evaluation.completeness
            ) / 4;

            const scores: ReflectionScores = {
                accuracy: evaluation.accuracy,
                relevance: evaluation.relevance,
                clarity: evaluation.clarity,
                completeness: evaluation.completeness,
                overallScore,
            };

            const shouldImprove = overallScore < this.qualityThreshold;

            const result: ReflectionResult = {
                scores,
                feedback: evaluation.feedback,
                shouldImprove,
                improvementSuggestions: evaluation.improvementSuggestions || undefined,
            };

            const duration = Date.now() - startTime;
            logger.info('Answer evaluation complete', {
                duration,
                overallScore,
                shouldImprove,
            });

            return result;
        } catch (error: any) {
            logger.error('Answer evaluation failed', {
                error: error.message,
                stack: error.stack,
            });

            console.log(chalk.red('\n❌ Evaluation Error:'));
            console.log(chalk.gray(`   ${error.message}`));
            console.log(chalk.yellow('   Using heuristic evaluation instead...\n'));

            // Fallback: Use heuristic evaluation based on answer characteristics
            const answerLength = agentAnswer.length;
            const hasStructure = agentAnswer.includes('\n') || agentAnswer.includes('- ');
            const questionWords = userQuestion.toLowerCase().split(/\s+/);
            const answerLower = agentAnswer.toLowerCase();

            // Check if answer mentions key words from question
            const relevanceScore = questionWords.filter(word =>
                word.length > 3 && answerLower.includes(word)
            ).length / Math.max(questionWords.filter(w => w.length > 3).length, 1);

            // Heuristic scores
            const heuristicScores = {
                accuracy: 0.7, // Assume reasonable accuracy
                relevance: Math.min(0.9, Math.max(0.4, relevanceScore)),
                clarity: hasStructure ? 0.75 : 0.6,
                completeness: Math.min(0.9, Math.max(0.4, answerLength / 500)), // Longer = more complete
                overallScore: 0,
            };

            heuristicScores.overallScore = (
                heuristicScores.accuracy +
                heuristicScores.relevance +
                heuristicScores.clarity +
                heuristicScores.completeness
            ) / 4;

            return {
                scores: heuristicScores,
                feedback: `Heuristic evaluation (LLM evaluation failed: ${error.message})`,
                shouldImprove: heuristicScores.overallScore < this.qualityThreshold,
                improvementSuggestions: heuristicScores.overallScore < this.qualityThreshold
                    ? 'Consider adding more detail and structure to the answer.'
                    : undefined,
            };
        }
    }

    /**
     * Generate an improved version of the answer based on feedback
     */
    async improveAnswer(
        userQuestion: string,
        originalAnswer: string,
        feedback: string,
        suggestions: string
    ): Promise<string> {
        const startTime = Date.now();

        logger.info('Generating improved answer', {
            questionLength: userQuestion.length,
            originalLength: originalAnswer.length,
        });

        try {
            const prompt = `You are an expert AI assistant improving a previous response.

USER QUESTION:
"${userQuestion}"

ORIGINAL ANSWER:
"${originalAnswer}"

EVALUATION FEEDBACK:
${feedback}

IMPROVEMENT SUGGESTIONS:
${suggestions}

Generate an improved version of the answer that addresses the feedback and suggestions.
Make it more accurate, relevant, clear, and complete.
Keep the same general structure but enhance the quality.

Provide ONLY the improved answer, without any meta-commentary.`;

            const improvedAnswer = await lmStudioClient.chatCompletion(
                [{ role: 'user', content: prompt }],
                { temperature: 0.4, maxTokens: 2000 }
            );

            const duration = Date.now() - startTime;
            logger.info('Improved answer generated', {
                duration,
                improvedLength: improvedAnswer.length,
            });

            return improvedAnswer;
        } catch (error: any) {
            logger.error('Answer improvement failed', {
                error: error.message,
            });

            // Return original answer if improvement fails
            return originalAnswer;
        }
    }

    /**
     * Display reflection results in the console
     */
    displayReflection(reflection: ReflectionResult): void {
        console.log(chalk.cyan('\n╔══════════════════════════════════════════════════════════╗'));
        console.log(chalk.cyan('║              SELF-REFLECTION & EVALUATION                ║'));
        console.log(chalk.cyan('╚══════════════════════════════════════════════════════════╝\n'));

        const { scores, feedback, shouldImprove, improvementSuggestions } = reflection;

        // Display scores
        console.log(chalk.white('Quality Scores:'));
        console.log(chalk.gray(`  Accuracy:     ${this.formatScore(scores.accuracy)}`));
        console.log(chalk.gray(`  Relevance:    ${this.formatScore(scores.relevance)}`));
        console.log(chalk.gray(`  Clarity:      ${this.formatScore(scores.clarity)}`));
        console.log(chalk.gray(`  Completeness: ${this.formatScore(scores.completeness)}`));
        console.log('');

        const overallColor = scores.overallScore >= 0.75 ? chalk.green : chalk.yellow;
        console.log(overallColor(`  Overall Score: ${(scores.overallScore * 100).toFixed(1)}%`));
        console.log('');

        // Display feedback
        console.log(chalk.white('Feedback:'));
        console.log(chalk.gray(`  ${feedback}`));
        console.log('');

        // Display improvement suggestions if needed
        if (shouldImprove && improvementSuggestions) {
            console.log(chalk.yellow('⚠ Quality below threshold - Improvement needed'));
            console.log(chalk.white('Suggestions:'));
            console.log(chalk.gray(`  ${improvementSuggestions}`));
            console.log('');
        } else {
            console.log(chalk.green('✓ Answer quality meets standards'));
            console.log('');
        }
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
}

// Export singleton instance
export const reflectionService = new ReflectionService();

