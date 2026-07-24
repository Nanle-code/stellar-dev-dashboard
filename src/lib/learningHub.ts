/**
 * Learning Hub System
 * Manages tutorials, quizzes, certifications, and progress tracking
 */

import { v4 as uuidv4 } from 'uuid';

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: 'basics' | 'advanced' | 'soroban' | 'assets' | 'payments';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  videoUrl?: string;
  content: string;
  codeExamples: CodeExample[];
  quiz?: Quiz;
  completed?: boolean;
  progress?: number;
}

export interface CodeExample {
  id: string;
  title: string;
  language: 'javascript' | 'typescript' | 'rust' | 'python';
  code: string;
  explanation: string;
  editable: boolean;
}

export interface Quiz {
  id: string;
  tutorialId: string;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface QuizResult {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  answers: number[];
  timestamp: string;
  passed: boolean;
}

export interface Certificate {
  id: string;
  userId: string;
  title: string;
  category: string;
  issuedAt: string;
  expiresAt?: string;
  verificationCode: string;
}

export interface UserProgress {
  userId: string;
  completedTutorials: string[];
  quizResults: QuizResult[];
  certificates: Certificate[];
  totalPoints: number;
  level: number;
}

const LEARNING_DB_NAME = 'stellar-dev-dashboard-learning';
const LEARNING_DB_VERSION = 1;
const PASSING_SCORE = 0.7; // 70%

class LearningHubManager {
  private db: IDBDatabase | null = null;
  private tutorials: Tutorial[] = [];

  async initialize(): Promise<void> {
    await this.initializeDatabase();
    this.initializeTutorials();
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(LEARNING_DB_NAME, LEARNING_DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('progress')) {
          const progressStore = db.createObjectStore('progress', { keyPath: 'userId' });
          progressStore.createIndex('level', 'level', { unique: false });
          progressStore.createIndex('totalPoints', 'totalPoints', { unique: false });
        }

        if (!db.objectStoreNames.contains('quizResults')) {
          const quizStore = db.createObjectStore('quizResults', { keyPath: 'id' });
          quizStore.createIndex('userId', 'userId', { unique: false });
          quizStore.createIndex('quizId', 'quizId', { unique: false });
          quizStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('certificates')) {
          const certStore = db.createObjectStore('certificates', { keyPath: 'id' });
          certStore.createIndex('userId', 'userId', { unique: false });
          certStore.createIndex('verificationCode', 'verificationCode', { unique: true });
        }
      };
    });
  }

  private initializeTutorials(): void {
    this.tutorials = [
      {
        id: 'tut-1',
        title: 'Introduction to Stellar',
        description: 'Learn the basics of the Stellar network, accounts, and assets',
        category: 'basics',
        difficulty: 'beginner',
        duration: 15,
        videoUrl: 'https://example.com/videos/intro-stellar',
        content: `
# Introduction to Stellar

Stellar is a decentralized, fast, scalable, and uniquely sustainable network for financial products and services.

## Key Concepts

1. **Accounts**: Every entity on Stellar has an account identified by a public key
2. **Assets**: Stellar supports multiple assets including XLM (native) and custom tokens
3. **Operations**: Transactions contain one or more operations that modify the ledger
4. **Consensus**: Stellar uses the Stellar Consensus Protocol (SCP)

## Why Stellar?

- Fast: 3-5 second confirmation times
- Low cost: Fractions of a penny per transaction
- Scalable: Thousands of operations per second
- Sustainable: Energy-efficient consensus mechanism
        `,
        codeExamples: [
          {
            id: 'ex-1',
            title: 'Creating a Keypair',
            language: 'javascript',
            code: `import { Keypair } from '@stellar/stellar-sdk';

// Generate a new random keypair
const pair = Keypair.random();

console.log('Public Key:', pair.publicKey());
console.log('Secret Key:', pair.secret());`,
            explanation: 'This code creates a new Stellar keypair. The public key is your account address, and the secret key is used to sign transactions.',
            editable: true,
          },
        ],
        quiz: {
          id: 'quiz-1',
          tutorialId: 'tut-1',
          questions: [
            {
              id: 'q-1',
              question: 'What is the native asset on Stellar?',
              options: ['BTC', 'ETH', 'XLM', 'USD'],
              correctAnswer: 2,
              explanation: 'XLM (Lumens) is the native cryptocurrency of the Stellar network.',
            },
            {
              id: 'q-2',
              question: 'How long do Stellar transactions typically take to confirm?',
              options: ['10 minutes', '1 minute', '3-5 seconds', '1 hour'],
              correctAnswer: 2,
              explanation: 'Stellar transactions are confirmed in 3-5 seconds, making it one of the fastest blockchain networks.',
            },
          ],
        },
      },
      {
        id: 'tut-2',
        title: 'Working with Accounts',
        description: 'Learn how to create, fund, and manage Stellar accounts',
        category: 'basics',
        difficulty: 'beginner',
        duration: 20,
        content: `
# Working with Accounts

Learn how to create and manage Stellar accounts programmatically.

## Account Creation

An account is created when it receives its first payment. On testnet, you can use Friendbot to fund new accounts.

## Account Properties

- Sequence number
- Balances (XLM and other assets)
- Signers
- Thresholds
- Flags
        `,
        codeExamples: [
          {
            id: 'ex-2',
            title: 'Funding a Testnet Account',
            language: 'javascript',
            code: `import { Keypair, SorobanRpc } from '@stellar/stellar-sdk';

const pair = Keypair.random();
const publicKey = pair.publicKey();

// Fund account on testnet
const response = await fetch(
  \`https://friendbot.stellar.org?addr=\${publicKey}\`
);

console.log('Account funded:', await response.json());`,
            explanation: 'Friendbot is a testnet faucet that funds new accounts with 10,000 XLM for testing.',
            editable: true,
          },
        ],
        quiz: {
          id: 'quiz-2',
          tutorialId: 'tut-2',
          questions: [
            {
              id: 'q-3',
              question: 'What is the minimum balance required for a Stellar account?',
              options: ['0 XLM', '1 XLM', '2 XLM (base reserve)', '10 XLM'],
              correctAnswer: 2,
              explanation: 'The base reserve is 1 XLM, and accounts need a minimum of 2 XLM (1 base + 1 per subentry).',
            },
          ],
        },
      },
      {
        id: 'tut-3',
        title: 'Sending Payments',
        description: 'Learn how to send payments on the Stellar network',
        category: 'payments',
        difficulty: 'intermediate',
        duration: 25,
        content: `
# Sending Payments

Learn how to create and submit payment transactions on Stellar.

## Transaction Structure

1. Source account
2. Sequence number
3. Operations (payment in this case)
4. Memo (optional)
5. Signatures
        `,
        codeExamples: [
          {
            id: 'ex-3',
            title: 'Sending XLM Payment',
            language: 'javascript',
            code: `import { 
  Keypair, 
  Server, 
  TransactionBuilder, 
  Networks, 
  Operation, 
  Asset 
} from '@stellar/stellar-sdk';

const server = new Server('https://horizon-testnet.stellar.org');
const sourceKeys = Keypair.fromSecret('SECRET_KEY');
const destination = 'DESTINATION_PUBLIC_KEY';

// Load source account
const account = await server.loadAccount(sourceKeys.publicKey());

// Build transaction
const transaction = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({
      destination,
      asset: Asset.native(),
      amount: '10',
    })
  )
  .setTimeout(30)
  .build();

// Sign and submit
transaction.sign(sourceKeys);
const result = await server.submitTransaction(transaction);
console.log('Success!', result);`,
            explanation: 'This code sends 10 XLM from one account to another on the testnet.',
            editable: true,
          },
        ],
        quiz: {
          id: 'quiz-3',
          tutorialId: 'tut-3',
          questions: [
            {
              id: 'q-4',
              question: 'What happens if you submit a transaction with the wrong sequence number?',
              options: [
                'The transaction succeeds',
                'The transaction is rejected',
                'The transaction is queued',
                'The sequence number is auto-corrected',
              ],
              correctAnswer: 1,
              explanation: 'Transactions with incorrect sequence numbers are rejected to prevent replay attacks.',
            },
          ],
        },
      },
    ];

    // Add more tutorials dynamically
    for (let i = 4; i <= 25; i++) {
      this.tutorials.push({
        id: `tut-${i}`,
        title: `Advanced Topic ${i - 3}`,
        description: `Learn advanced Stellar concepts and techniques - Part ${i - 3}`,
        category: i % 2 === 0 ? 'advanced' : 'soroban',
        difficulty: 'advanced',
        duration: 30 + (i % 10),
        content: `# Advanced Topic ${i - 3}\n\nDetailed content for advanced tutorial ${i - 3}...`,
        codeExamples: [],
      });
    }
  }

  async getAllTutorials(): Promise<Tutorial[]> {
    return this.tutorials;
  }

  async getTutorialsByCategory(category: string): Promise<Tutorial[]> {
    return this.tutorials.filter((t) => t.category === category);
  }

  async getTutorial(id: string): Promise<Tutorial | null> {
    return this.tutorials.find((t) => t.id === id) || null;
  }

  async submitQuiz(
    userId: string,
    quizId: string,
    answers: number[]
  ): Promise<QuizResult> {
    const tutorial = this.tutorials.find((t) => t.quiz?.id === quizId);
    if (!tutorial?.quiz) throw new Error('Quiz not found');

    const { questions } = tutorial.quiz;
    let correctCount = 0;

    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctCount++;
      }
    });

    const score = correctCount / questions.length;
    const passed = score >= PASSING_SCORE;

    const result: QuizResult = {
      id: uuidv4(),
      quizId,
      userId,
      score,
      totalQuestions: questions.length,
      answers,
      timestamp: new Date().toISOString(),
      passed,
    };

    await this.saveQuizResult(result);

    if (passed) {
      await this.markTutorialComplete(userId, tutorial.id);
    }

    return result;
  }

  private async saveQuizResult(result: QuizResult): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['quizResults'], 'readwrite');
      const store = transaction.objectStore('quizResults');
      const request = store.add(result);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async markTutorialComplete(userId: string, tutorialId: string): Promise<void> {
    const progress = await this.getUserProgress(userId);
    if (!progress.completedTutorials.includes(tutorialId)) {
      progress.completedTutorials.push(tutorialId);
      progress.totalPoints += 100;
      progress.level = Math.floor(progress.totalPoints / 500) + 1;
      await this.saveUserProgress(progress);
    }
  }

  async getUserProgress(userId: string): Promise<UserProgress> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['progress'], 'readonly');
      const store = transaction.objectStore('progress');
      const request = store.get(userId);

      request.onsuccess = () => {
        resolve(
          request.result || {
            userId,
            completedTutorials: [],
            quizResults: [],
            certificates: [],
            totalPoints: 0,
            level: 1,
          }
        );
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async saveUserProgress(progress: UserProgress): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['progress'], 'readwrite');
      const store = transaction.objectStore('progress');
      const request = store.put(progress);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async issueCertificate(userId: string, category: string): Promise<Certificate> {
    const cert: Certificate = {
      id: uuidv4(),
      userId,
      title: `Stellar ${category.charAt(0).toUpperCase() + category.slice(1)} Certification`,
      category,
      issuedAt: new Date().toISOString(),
      verificationCode: this.generateVerificationCode(),
    };

    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['certificates'], 'readwrite');
      const store = transaction.objectStore('certificates');
      const request = store.add(cert);

      request.onsuccess = () => resolve(cert);
      request.onerror = () => reject(request.error);
    });
  }

  async getCertificates(userId: string): Promise<Certificate[]> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['certificates'], 'readonly');
      const store = transaction.objectStore('certificates');
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private generateVerificationCode(): string {
    return `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}

export const learningHub = new LearningHubManager();
