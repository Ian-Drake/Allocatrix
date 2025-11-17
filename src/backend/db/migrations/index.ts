import migration001 from './001-create-model-portfolios';
import migration002 from './002-create-asset-classes';
import migration003 from './003-create-model-portfolio-asset-classes';
import migration004 from './004-create-ticker-allocations';
import migration005 from './005-create-accounts';
import migration006 from './006-create-schwab-tokens';
import migration007 from './007-create-account-snapshots';
import migration008 from './008-create-audit-log';
import migration009 from './009-create-backtest-results';

export const migrations = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
];
