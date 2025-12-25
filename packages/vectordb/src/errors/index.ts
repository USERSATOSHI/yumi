import { ErrorBase } from '@yumi/results';

type Kinds =
    | 'Unknown'
    // Connection errors
    | 'ConnectionFailed'
    | 'ConnectionClosed'
    | 'DatabaseNotFound'
    // Query errors
    | 'QueryFailed'
    | 'InvalidQuery'
    | 'Timeout'
    // Constraint errors
    | 'UniqueViolation'
    | 'ForeignKeyViolation'
    | 'NotNullViolation'
    | 'CheckViolation'
    // Data errors
    | 'NotFound'
    | 'InvalidData'
    | 'TypeMismatch'
    | 'DimensionMismatch'
    // Transaction errors
    | 'TransactionFailed'
    | 'DeadlockDetected'
    // Schema errors
    | 'MigrationFailed'
    | 'SchemaInvalid'
    // Embedding/Vector specific
    | 'EmbeddingFailed'
    | 'InvalidEmbedding'
    | 'SearchFailed';

export class DBError extends ErrorBase<Kinds> {
    // Connection
    static Unknown(message: string) { return new DBError(message, 'Unknown'); }
    static ConnectionFailed(message: string) { return new DBError(message, 'ConnectionFailed'); }
    static ConnectionClosed(message: string) { return new DBError(message, 'ConnectionClosed'); }
    static DatabaseNotFound(path: string) { return new DBError(`Database not found: ${path}`, 'DatabaseNotFound'); }

    // Query
    static QueryFailed(message: string) { return new DBError(message, 'QueryFailed'); }
    static InvalidQuery(message: string) { return new DBError(message, 'InvalidQuery'); }
    static Timeout(operation: string) { return new DBError(`Operation timed out: ${operation}`, 'Timeout'); }

    // Constraints
    static UniqueViolation(field: string) { return new DBError(`Unique constraint violated: ${field}`, 'UniqueViolation'); }
    static ForeignKeyViolation(message: string) { return new DBError(message, 'ForeignKeyViolation'); }
    static NotNullViolation(field: string) { return new DBError(`Field cannot be null: ${field}`, 'NotNullViolation'); }
    static CheckViolation(message: string) { return new DBError(message, 'CheckViolation'); }

    // Data
    static NotFound(entity: string, id?: string) { return new DBError(`${entity} not found${id ? `: ${id}` : ''}`, 'NotFound'); }
    static InvalidData(message: string) { return new DBError(message, 'InvalidData'); }
    static TypeMismatch(expected: string, got: string) { return new DBError(`Type mismatch: expected ${expected}, got ${got}`, 'TypeMismatch'); }
    static DimensionMismatch(expected: number, got: number) { return new DBError(`Embedding dimension mismatch: expected ${expected}, got ${got}`, 'DimensionMismatch'); }

    // Transaction
    static TransactionFailed(message: string) { return new DBError(message, 'TransactionFailed'); }
    static DeadlockDetected() { return new DBError('Deadlock detected', 'DeadlockDetected'); }

    // Schema
    static MigrationFailed(version: string, reason: string) { return new DBError(`Migration ${version} failed: ${reason}`, 'MigrationFailed'); }
    static SchemaInvalid(message: string) { return new DBError(message, 'SchemaInvalid'); }

    // Vector/Embedding specific
    static EmbeddingFailed(message: string) { return new DBError(message, 'EmbeddingFailed'); }
    static InvalidEmbedding(reason: string) { return new DBError(`Invalid embedding: ${reason}`, 'InvalidEmbedding'); }
    static SearchFailed(message: string) { return new DBError(message, 'SearchFailed'); }
}