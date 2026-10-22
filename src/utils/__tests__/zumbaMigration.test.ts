import assert from 'node:assert/strict';
import {
  getServiceTitlesForDisabledZumbaPlan,
  migrateLegacyZumbaCredits,
  normalizePlanKeyForDisabledZumba,
} from '../zumbaMigration';

const migratedCredits = migrateLegacyZumbaCredits({ yoga: 1, zumba: 2, specialty: 1 });
assert.deepEqual(migratedCredits, { yoga: 3, zumba: 0, specialty: 1 });

assert.equal(normalizePlanKeyForDisabledZumba('gold-zumba'), 'gold-yoga');
assert.equal(normalizePlanKeyForDisabledZumba('gold-mixed'), 'gold-yoga');
assert.equal(normalizePlanKeyForDisabledZumba('diamond'), 'diamond');
assert.deepEqual(getServiceTitlesForDisabledZumbaPlan('gold-zumba'), ['Yoga', 'Zumba Dance']);
assert.deepEqual(getServiceTitlesForDisabledZumbaPlan('gold-mixed'), ['Yoga', 'Zumba Dance']);
assert.deepEqual(getServiceTitlesForDisabledZumbaPlan('diamond'), ['Yoga', 'Zumba Dance', 'Diet & Nutrition']);
assert.deepEqual(getServiceTitlesForDisabledZumbaPlan('platinum'), ['Yoga', 'Zumba Dance', 'Diet & Nutrition']);

console.log('zumbaMigration tests passed');
