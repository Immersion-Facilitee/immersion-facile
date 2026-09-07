import type { MigrationBuilder } from "node-pg-migrate";

const ftConnectUsersTable = "ft_connect_users";
const conventionsFtConnectUsersTable = "conventions__ft_connect_users";
const oldFtConnectUsersTable = `_old_${ftConnectUsersTable}`;
const oldConventionsFtConnectUsersTable = `_old_${conventionsFtConnectUsersTable}`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE actors
    SET extra_fields = jsonb_set(
      COALESCE(extra_fields, '{}'::jsonb),
      '{federatedIdentity}',
      jsonb_strip_nulls(
        jsonb_build_object(
          'provider', 'ftConnect',
          'token', ftu.ft_connect_id,
          'payload', CASE
            WHEN ftu.advisor_email IS NOT NULL THEN
              jsonb_build_object(
                'advisor', jsonb_build_object(
                  'email', ftu.advisor_email,
                  'firstName', ftu.advisor_firstname,
                  'lastName', ftu.advisor_lastname,
                  'type', ftu.advisor_kind
                )
              )
            ELSE NULL
          END
        )
      )
    )
    FROM conventions c
    INNER JOIN ${conventionsFtConnectUsersTable} cftu
      ON cftu.convention_id = c.id
    INNER JOIN ${ftConnectUsersTable} ftu
      ON ftu.ft_connect_id = cftu.ft_connect_id
    WHERE actors.id = c.beneficiary_id;
  `);

  pgm.renameTable(
    conventionsFtConnectUsersTable,
    oldConventionsFtConnectUsersTable,
  );
  pgm.renameTable(ftConnectUsersTable, oldFtConnectUsersTable);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.renameTable(oldFtConnectUsersTable, ftConnectUsersTable);
  pgm.renameTable(
    oldConventionsFtConnectUsersTable,
    conventionsFtConnectUsersTable,
  );

  pgm.sql(`
    UPDATE actors
    SET extra_fields = extra_fields - 'federatedIdentity'
    WHERE extra_fields ? 'federatedIdentity';
  `);
}
