-- Multi-Company Migration v4
-- =========================================
-- TorqueTools ERP - Sistema Multi-Empresa con Operaciones Intercompany
-- Ejecutado: 2026-04-11

-- 1. Add company relationship fields to tt_companies
ALTER TABLE tt_companies ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT 'internal';
ALTER TABLE tt_companies ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES tt_companies(id);
ALTER TABLE tt_companies ADD COLUMN IF NOT EXISTS is_active_in_system BOOLEAN DEFAULT true;

-- 2. User -> Company access table
CREATE TABLE IF NOT EXISTS tt_user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES tt_users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES tt_companies(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  can_sell BOOLEAN DEFAULT true,
  can_buy BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- 3. Intercompany relationships
CREATE TABLE IF NOT EXISTS tt_intercompany_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_company_id UUID REFERENCES tt_companies(id),
  seller_company_id UUID REFERENCES tt_companies(id),
  active BOOLEAN DEFAULT true,
  default_currency TEXT DEFAULT 'EUR',
  default_incoterm TEXT DEFAULT 'EXW',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(buyer_company_id, seller_company_id)
);

-- 4. Update company types
UPDATE tt_companies SET company_type = 'internal'
WHERE name IN ('TorqueTools SL', 'Global Assembly Solutions LLC', 'BuscaTools SA', 'Torquear SA');

-- 5. Give Juan (super_admin) access to ALL companies
INSERT INTO tt_user_companies (user_id, company_id, is_default, can_sell, can_buy)
SELECT u.id, c.id, c.name = 'TorqueTools SL', true, true
FROM tt_users u CROSS JOIN tt_companies c
WHERE u.username = 'juan'
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 6. Give vendedores access to TorqueTools SL and BuscaTools
INSERT INTO tt_user_companies (user_id, company_id, is_default)
SELECT u.id, c.id, c.name = 'TorqueTools SL'
FROM tt_users u CROSS JOIN tt_companies c
WHERE u.username IN ('facu', 'norber', 'jano') AND c.name IN ('TorqueTools SL', 'BuscaTools SA')
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 7. Set up intercompany relations
INSERT INTO tt_intercompany_relations (buyer_company_id, seller_company_id, default_currency, default_incoterm)
SELECT buyer.id, seller.id, 'EUR', 'EXW'
FROM tt_companies buyer, tt_companies seller
WHERE buyer.name = 'BuscaTools SA' AND seller.name = 'TorqueTools SL'
ON CONFLICT (buyer_company_id, seller_company_id) DO NOTHING;

INSERT INTO tt_intercompany_relations (buyer_company_id, seller_company_id, default_currency, default_incoterm)
SELECT buyer.id, seller.id, 'USD', 'EXW'
FROM tt_companies buyer, tt_companies seller
WHERE buyer.name = 'BuscaTools SA' AND seller.name = 'Global Assembly Solutions LLC'
ON CONFLICT (buyer_company_id, seller_company_id) DO NOTHING;

INSERT INTO tt_intercompany_relations (buyer_company_id, seller_company_id, default_currency, default_incoterm)
SELECT buyer.id, seller.id, 'EUR', 'EXW'
FROM tt_companies buyer, tt_companies seller
WHERE buyer.name = 'Torquear SA' AND seller.name = 'TorqueTools SL'
ON CONFLICT (buyer_company_id, seller_company_id) DO NOTHING;

INSERT INTO tt_intercompany_relations (buyer_company_id, seller_company_id, default_currency, default_incoterm)
SELECT buyer.id, seller.id, 'USD', 'EXW'
FROM tt_companies buyer, tt_companies seller
WHERE buyer.name = 'Torquear SA' AND seller.name = 'Global Assembly Solutions LLC'
ON CONFLICT (buyer_company_id, seller_company_id) DO NOTHING;

-- 8. Enable RLS on new tables
ALTER TABLE tt_user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_intercompany_relations ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access user_companies') THEN
    CREATE POLICY "Service role full access user_companies" ON tt_user_companies FOR ALL TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own company access') THEN
    CREATE POLICY "Users can view own company access" ON tt_user_companies FOR SELECT TO authenticated USING (
      user_id IN (SELECT id FROM tt_users WHERE auth_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access intercompany') THEN
    CREATE POLICY "Service role full access intercompany" ON tt_intercompany_relations FOR ALL TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can view intercompany') THEN
    CREATE POLICY "Authenticated can view intercompany" ON tt_intercompany_relations FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
