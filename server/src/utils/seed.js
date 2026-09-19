require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { seedUsers, seedProjects, getSeedTasks } = require('./seedData');

const seed = async () => {
  try {
    const primaryUri = process.env.MONGODB_URI;
    console.log('[Seed] Connecting to MongoDB...');
    let isAtlas = false;

    try {
      if (primaryUri) {
        await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 6000 });
        console.log(`[Seed] Connected to primary MongoDB: ${mongoose.connection.host}`);
        isAtlas = primaryUri.includes('mongodb+srv://') || primaryUri.includes('cluster0');
      } else {
        throw new Error('No MONGODB_URI found in environment.');
      }
    } catch (primaryErr) {
      console.warn(`[Seed Warning] Could not connect to primary MongoDB (${primaryErr.message})`);
      console.log('\n------------------------------------------------------------');
      console.log(' MONGODB ATLAS IP WHITELIST INSTRUCTIONS:');
      console.log(' Your current public IP is: 43.250.253.180');
      console.log(' 1. Go to https://cloud.mongodb.com and log in.');
      console.log(' 2. Go to "Network Access" under "Security".');
      console.log(' 3. Click "+ Add IP Address".');
      console.log(' 4. Select "Allow Access from Anywhere" (0.0.0.0/0)');
      console.log('    OR add your IP (43.250.253.180).');
      console.log(' 5. Confirm. Once saved, rerun: npm run seed');
      console.log('------------------------------------------------------------\n');
      console.log('[Seed] Falling back to in-memory database to verify seed data...');
      await connectDB();
    }

    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Project.deleteMany({}),
      Task.deleteMany({}),
    ]);

    console.log('[Seed] Creating users...');
    const createdUsers = await User.create(seedUsers);
    console.log(`[Seed] Created ${createdUsers.length} users.`);

    // Build email-to-id map
    const userMap = {};
    createdUsers.forEach((u) => {
      userMap[u.email] = u._id;
    });

    console.log('[Seed] Creating projects...');
    const allMembers = Object.values(userMap);

    const project1 = await Project.create({
      ...seedProjects[0],
      owner: userMap['manager@teamup.dev'] || createdUsers[0]._id,
      members: allMembers,
    });

    const project2 = await Project.create({
      ...seedProjects[1],
      owner: userMap['admin@teamup.dev'] || createdUsers[0]._id,
      members: allMembers,
    });

    const project3 = await Project.create({
      ...seedProjects[2],
      owner: userMap['manager@teamup.dev'] || createdUsers[0]._id,
      members: allMembers,
    });

    const project4 = await Project.create({
      ...seedProjects[3],
      owner: userMap['admin@teamup.dev'] || createdUsers[0]._id,
      members: allMembers,
    });

    console.log(`[Seed] Created 4 projects: "${project1.name}", "${project2.name}", "${project3.name}", "${project4.name}".`);

    console.log('[Seed] Creating tasks...');
    const tasksData = getSeedTasks(project1._id, project2._id, project3._id, project4._id, userMap);
    const createdTasks = await Task.create(tasksData);
    console.log(`[Seed] Created ${createdTasks.length} tasks.`);

    console.log('\n=============================================');
    console.log(' SEEDING COMPLETE! Sample Credentials:');
    console.log('---------------------------------------------');
    console.log(' ADMIN   : admin@teamup.dev   / password123');
    console.log(' MANAGER : manager@teamup.dev / password123');
    console.log(' MEMBER 1: charlie@teamup.dev / password123');
    console.log(' MEMBER 2: diana@teamup.dev   / password123');
    console.log(' MEMBER 3: evan@teamup.dev    / password123');
    console.log('=============================================\n');

    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
};

seed();
