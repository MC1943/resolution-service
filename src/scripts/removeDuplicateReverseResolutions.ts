// @ts-ignore
import { Client } from 'pg';

const {
  RESOLUTION_POSTGRES_USERNAME: user,
  RESOLUTION_POSTGRES_HOST: host,
  RESOLUTION_POSTGRES_DATABASE: database,
  RESOLUTION_POSTGRES_PASSWORD: password,
  RESOLUTION_POSTGRES_PORT: port_number,
} = process.env;

const port = Number(port_number);
const client = new Client({ user, host, database, password, port });
const deleteQuery = `
DELETE FROM domains_reverse_resolution 
WHERE domains_reverse_resolution.id NOT IN (
  SELECT id FROM 
   (
      SELECT 
        id, created_at, reverse_address, blockchain, network_id,
        RANK() OVER (PARTITION BY reverse_address, blockchain, network_id ORDER BY created_at DESC) dest_rank
      FROM domains_reverse_resolution
   ) as tmp where dest_rank = 1
)`;

const run = async () => {
  try {
    await client.connect();
    const { rows } = await client.query(deleteQuery);
    console.log(`Deleted ${rows.length} entries.`);
    await client.end();
  } catch (error) {
    console.log('Delete failed!', error);
  }
};

run();
