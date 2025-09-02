#!/bin/bash

# Direct SQL approach to create admin user
# Usage: ./scripts/create-admin-direct.sh

echo "🔐 Creating Admin User via Direct SQL Connection"
echo "=============================================="

# Admin details
ADMIN_NAME="Diwaker"
ADMIN_EMAIL="diwaker@evolveevents.in"
ADMIN_MOBILE="+919606896067"
ADMIN_PASSWORD="IevolveAdmin2025!"

echo "👤 Admin Name: $ADMIN_NAME"
echo "📧 Email: $ADMIN_EMAIL"
echo "📱 Mobile: $ADMIN_MOBILE"
echo ""

# Generate bcrypt hash for password (using node.js)
echo "🔒 Generating password hash..."
HASHED_PASSWORD=$(node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('$ADMIN_PASSWORD', 10);
console.log(hash);
")

echo "✅ Password hashed successfully"
echo ""

# Create SQL command
SQL_COMMAND="INSERT INTO users (id, email, password, mobile_number, name, role, is_active, created_at, updated_at) VALUES (gen_random_uuid(), '$ADMIN_EMAIL', '$HASHED_PASSWORD', '$ADMIN_MOBILE', '$ADMIN_NAME', 'admin', true, NOW(), NOW()) RETURNING id, name, email, mobile_number;"

echo "🔗 Connecting to Cloud SQL..."
echo "📝 Executing admin creation..."

# Execute the SQL command
gcloud sql connect ievolve-db --user=ievolve_user --project=ievolve-sports-2025 --quiet <<EOF
$SQL_COMMAND
\q
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Admin user created successfully!"
    echo "👤 Name: $ADMIN_NAME"
    echo "📧 Email: $ADMIN_EMAIL"
    echo "📱 Mobile: $ADMIN_MOBILE"
    echo ""
    echo "🔑 Login credentials:"
    echo "   Email: $ADMIN_EMAIL"
    echo "   Password: $ADMIN_PASSWORD"
    echo ""
    echo "🚀 You can now log in to your application!"
else
    echo "❌ Failed to create admin user"
    exit 1
fi