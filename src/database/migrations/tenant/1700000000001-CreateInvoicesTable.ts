import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Creates the `invoices` table within a tenant schema.
 */
export class CreateInvoicesTable1700000000001 implements MigrationInterface {
  name = 'CreateInvoicesTable1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'invoices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'invoice_number',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
            default: "'draft'",
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'due_date',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'UQ_invoices_number',
        columnNames: ['invoice_number'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'invoices',
      new TableForeignKey({
        name: 'FK_invoices_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('invoices', 'FK_invoices_user');
    await queryRunner.dropIndex('invoices', 'UQ_invoices_number');
    await queryRunner.dropTable('invoices');
  }
}
