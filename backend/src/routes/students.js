'use strict';

const { Router } = require('express');
const multer     = require('multer');
const { parse }  = require('csv-parse/sync');
const { Op }     = require('sequelize');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifyToken }  = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { Student }      = require('../database');
const logger           = require('../utils/logger');

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

// ── POST /api/students/import ────────────────────────────────────────────────
// Auth: Admin only
// Accepts CSV with columns: student_id, full_name, email, department, graduation_year
router.post('/import',
    verifyToken,
    requireRole('Admin'),
    upload.single('csv'),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'CSV file is required.' });
        }

        const csvText = req.file.buffer.toString('utf-8');
        let records;
        try {
            records = parse(csvText, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
        } catch (err) {
            return res.status(400).json({ message: 'Invalid CSV format: ' + err.message });
        }

        if (records.length === 0) {
            return res.status(400).json({ message: 'CSV file is empty.' });
        }

        const results = { imported: 0, skipped: 0, errors: [] };

        for (let i = 0; i < records.length; i++) {
            const row = records[i];
            const rowNum = i + 2;

            try {
                const student_id = (row.student_id || '').trim();
                const full_name  = (row.full_name || row.fullName || '').trim();
                const email      = (row.email || '').trim();
                const department = (row.department || '').trim();
                const graduation_year = (row.graduation_year || row.graduationYear || '').trim();

                if (!student_id || !full_name || !email || !department || !graduation_year) {
                    results.errors.push({ row: rowNum, message: 'Missing required fields', data: row });
                    continue;
                }

                const existing = await Student.findByPk(student_id);
                if (existing) {
                    await existing.update({ full_name, email, department, graduation_year, imported_by: req.user.id });
                    results.skipped++;
                } else {
                    await Student.create({
                        student_id,
                        full_name,
                        email,
                        department,
                        graduation_year,
                        imported_by: req.user.id,
                    });
                    results.imported++;
                }
            } catch (err) {
                results.errors.push({ row: rowNum, message: err.message, data: row });
            }
        }

        logger.info(`Student import: ${results.imported} new, ${results.skipped} updated, ${results.errors.length} errors`);

        res.status(201).json({
            message: `Imported ${results.imported} students (${results.skipped} updated, ${results.errors.length} errors).`,
            results,
        });
    })
);

// ── GET /api/students ─────────────────────────────────────────────────────────
// Auth: Admin
router.get('/',
    verifyToken,
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const {
            search,
            department,
            graduation_year,
            page  = 1,
            limit = 50,
        } = req.query;

        const where = {};

        if (search) {
            where[Op.or] = [
                { student_id: { [Op.iLike]: `%${search}%` } },
                { full_name:  { [Op.iLike]: `%${search}%` } },
                { email:      { [Op.iLike]: `%${search}%` } },
            ];
        }
        if (department && department !== 'All') {
            where.department = department;
        }
        if (graduation_year) {
            where.graduation_year = graduation_year;
        }

        const { rows, count } = await Student.findAndCountAll({
            where,
            order:  [['full_name', 'ASC']],
            limit:  parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
        });

        res.status(200).json({
            students: rows,
            total: count,
            page:   parseInt(page),
            pages:  Math.ceil(count / parseInt(limit)),
        });
    })
);

// ── DELETE /api/students/:student_id ──────────────────────────────────────────
// Auth: Admin
router.delete('/:student_id',
    verifyToken,
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const student = await Student.findByPk(req.params.student_id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }
        await student.destroy();
        logger.info(`Student removed: ${req.params.student_id} by ${req.user.username}`);
        res.status(200).json({ message: 'Student removed from roster.' });
    })
);

module.exports = router;
