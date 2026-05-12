# ChemClean Pro v3

## Запуск (покроково)

### 1. База даних
В pgAdmin → Query Tool (база postgres):
```sql
CREATE DATABASE chemclean ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
```

### 2. Накатити схему
PowerShell:
```
chcp 65001
psql -U postgres -d chemclean -f server/db/schema.sql
```

### 3. Виправити паролі
В pgAdmin → Query Tool (база chemclean):
```sql
UPDATE employees SET password_hash='$2a$10$y9GGx5E631JujzfYmPlsN.dRJ9ETndNPCqQC/MxdB3QEn7fcoFC9u' WHERE login IN ('admin','kovalenko','melnyk','bondarenko');
```

### 4. Налаштувати .env
Скопіюй `.env.example` → `server/.env`, впиши свій пароль PostgreSQL

### 5. Встановити залежності
```
npm run install:all
```

### 6. Запустити

Термінал 1:
```
cd server
npm run dev
```

Термінал 2:
```
npm start
```

Відкрий: http://localhost:3000

## Логіни (пароль: password123)
- admin
- kovalenko
- melnyk
- bondarenko
