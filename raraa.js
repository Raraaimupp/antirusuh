#!/usr/bin/env bash
set -e

PANEL_DIR="/var/www/pterodactyl"
ADMIN_ID=1
TS=$(date +%s)
BACKUP_DIR="$PANEL_DIR/ownerpatch_backup_$TS"

mkdir -p "$BACKUP_DIR"

msg="Lu Siapa Kocak? Hanya Pemilik Server Yang Bisa! Lu babu gabakal bisa."

echo "=== Pterodactyl Owner-Only Anti Rusuh Patch ==="
echo "Backup dir: $BACKUP_DIR"

backup_file() {
    if [ -f "$1" ]; then
        cp "$1" "$BACKUP_DIR/"
        echo "Backup: $1"
    fi
}

patch_policy() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "File tidak ditemukan: $file"
        return
    fi

    backup_file "$file"

    cat > "$file.patch" <<EOF
<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Server;

class $(basename $file .php)
{
    public function before(\$user, \$ability)
    {
        if (\$user->id === $ADMIN_ID) return true;
    }

    private function check(\$user, \$server)
    {
        if (\$user->id !== \$server->owner_id) {
            abort(403, "$msg");
        }
        return true;
    }
EOF

    # append functions depending on file type
    if [[ "$file" == *"ServerPolicy.php"* ]]; then
cat >> "$file.patch" <<EOF
    public function view(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function updateDetails(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function updateBuild(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function updateStartup(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function restart(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function start(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function stop(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function reinstall(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function rebuild(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
EOF
    fi

    if [[ "$file" == *"FilePolicy.php"* ]]; then
cat >> "$file.patch" <<EOF
    public function read(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function write(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function delete(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function create(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
EOF
    fi

    if [[ "$file" == *"SubuserPolicy.php"* ]]; then
cat >> "$file.patch" <<EOF
    public function create(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function delete(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
EOF
    fi

    if [[ "$file" == *"DatabasePolicy.php"* ]]; then
cat >> "$file.patch" <<EOF
    public function create(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function update(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function delete(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
EOF
    fi

    if [[ "$file" == *"SchedulePolicy.php"* ]]; then
cat >> "$file.patch" <<EOF
    public function create(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function update(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
    public function delete(User \$user, Server \$server) { return \$this->check(\$user, \$server); }
EOF
    fi

echo "}" >> "$file.patch"

mv "$file.patch" "$file"
echo "Patched: $file"
}

# patch all policy files
patch_policy "$PANEL_DIR/app/Policies/ServerPolicy.php"
patch_policy "$PANEL_DIR/app/Policies/FilePolicy.php"
patch_policy "$PANEL_DIR/app/Policies/SubuserPolicy.php"
patch_policy "$PANEL_DIR/app/Policies/DatabasePolicy.php"
patch_policy "$PANEL_DIR/app/Policies/SchedulePolicy.php"

cd "$PANEL_DIR"
php artisan cache:clear
php artisan view:clear
php artisan optimize
systemctl restart pteroq

echo "=== PATCH SELESAI ==="
echo "User hanya bisa mengelola server miliknya sendiri!"
echo "Admin ID=1 tetap full akses!"
