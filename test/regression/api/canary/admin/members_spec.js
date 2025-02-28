const path = require('path');
const should = require('should');
const supertest = require('supertest');
const sinon = require('sinon');
const testUtils = require('../../../../utils');
const localUtils = require('./utils');
const config = require('../../../../../core/shared/config');
const labs = require('../../../../../core/server/services/labs');

const ghost = testUtils.startGhost;

let request;

describe('Members API', function () {
    before(function () {
        sinon.stub(labs, 'isSet').withArgs('members').returns(true);
    });

    after(function () {
        sinon.restore();
    });

    before(function () {
        return ghost()
            .then(function () {
                request = supertest.agent(config.get('url'));
            })
            .then(function () {
                return localUtils.doAuth(request, 'members');
            });
    });

    it('Can search by case-insensitive name', function () {
        return request
            .get(localUtils.API.getApiQuery('members/?search=egg'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;
                should.exist(jsonResponse);
                should.exist(jsonResponse.members);
                jsonResponse.members.should.have.length(1);
                jsonResponse.members[0].email.should.equal('member1@test.com');
                localUtils.API.checkResponse(jsonResponse, 'members');
                localUtils.API.checkResponse(jsonResponse.members[0], 'member', 'stripe');
                localUtils.API.checkResponse(jsonResponse.meta.pagination, 'pagination');
            });
    });

    it('Can search by case-insensitive email', function () {
        return request
            .get(localUtils.API.getApiQuery('members/?search=MEMBER2'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;
                should.exist(jsonResponse);
                should.exist(jsonResponse.members);
                jsonResponse.members.should.have.length(1);
                jsonResponse.members[0].email.should.equal('member2@test.com');
                localUtils.API.checkResponse(jsonResponse, 'members');
                localUtils.API.checkResponse(jsonResponse.members[0], 'member', 'stripe');
                localUtils.API.checkResponse(jsonResponse.meta.pagination, 'pagination');
            });
    });

    it('Can search for paid members', function () {
        return request
            .get(localUtils.API.getApiQuery('members/?search=egon&paid=true'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;
                should.exist(jsonResponse);
                should.exist(jsonResponse.members);
                jsonResponse.members.should.have.length(1);
                jsonResponse.members[0].email.should.equal('paid@test.com');
                localUtils.API.checkResponse(jsonResponse, 'members');
                localUtils.API.checkResponse(jsonResponse.members[0], 'member', 'stripe');
                localUtils.API.checkResponse(jsonResponse.meta.pagination, 'pagination');
            });
    });

    it('Add should fail when passing incorrect email_type query parameter', function () {
        const member = {
            name: 'test',
            email: 'memberTestAdd@test.com'
        };

        return request
            .post(localUtils.API.getApiQuery(`members/?send_email=true&email_type=lel`))
            .send({members: [member]})
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(422);
    });

    // NOTE: this test should be enabled and expanded once test suite fully supports Stripe mocking
    it.skip('Can set a "Complimentary" subscription', function () {
        const memberToChange = {
            name: 'Comped Member',
            email: 'member2comp@test.com'
        };

        const memberChanged = {
            comped: true
        };

        return request
            .post(localUtils.API.getApiQuery(`members/`))
            .send({members: [memberToChange]})
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;
                should.exist(jsonResponse);
                should.exist(jsonResponse.members);
                jsonResponse.members.should.have.length(1);

                return jsonResponse.members[0];
            })
            .then((newMember) => {
                return request
                    .put(localUtils.API.getApiQuery(`members/${newMember.id}/`))
                    .send({members: [memberChanged]})
                    .set('Origin', config.get('url'))
                    .expect('Content-Type', /json/)
                    .expect('Cache-Control', testUtils.cacheRules.private)
                    .expect(200)
                    .then((res) => {
                        should.not.exist(res.headers['x-cache-invalidate']);

                        const jsonResponse = res.body;

                        should.exist(jsonResponse);
                        should.exist(jsonResponse.members);
                        jsonResponse.members.should.have.length(1);
                        localUtils.API.checkResponse(jsonResponse.members[0], 'member', 'stripe');
                        jsonResponse.members[0].name.should.equal(memberToChange.name);
                        jsonResponse.members[0].email.should.equal(memberToChange.email);
                        jsonResponse.members[0].comped.should.equal(memberToChange.comped);
                    });
            });
    });

    it('Can delete a member without cancelling Stripe Subscription', async function () {
        const member = {
            name: 'Member 2 Delete',
            email: 'Member2Delete@test.com'
        };

        const createdMember = await request.post(localUtils.API.getApiQuery(`members/`))
            .send({members: [member]})
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;
                should.exist(jsonResponse);
                should.exist(jsonResponse.members);
                jsonResponse.members.should.have.length(1);

                return jsonResponse.members[0];
            });

        await request.delete(localUtils.API.getApiQuery(`members/${createdMember.id}/`))
            .set('Origin', config.get('url'))
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(204)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);

                const jsonResponse = res.body;

                should.exist(jsonResponse);
            });
    });

    // NOTE: this test should be enabled and expanded once test suite fully supports Stripe mocking
    it.skip('Can delete a member and cancel Stripe Subscription', async function () {
        const member = {
            name: 'Member 2 Delete',
            email: 'Member2Delete@test.com',
            comped: true
        };

        const createdMember = await request.post(localUtils.API.getApiQuery(`members/`))
            .send({members: [member]})
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;
                should.exist(jsonResponse);
                should.exist(jsonResponse.members);
                jsonResponse.members.should.have.length(1);

                return jsonResponse.members[0];
            });

        await request.delete(localUtils.API.getApiQuery(`members/${createdMember.id}/?cancel=true`))
            .set('Origin', config.get('url'))
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(204)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);

                const jsonResponse = res.body;

                should.exist(jsonResponse);
            });
    });

    // NOTE: this test should be enabled and expanded once test suite fully supports Stripe mocking
    it.skip('Does not cancel Stripe Subscription if cancel_subscriptions is not set to "true"', async function () {
        const member = {
            name: 'Member 2 Delete',
            email: 'Member2Delete@test.com',
            comped: true
        };

        const createdMember = await request.post(localUtils.API.getApiQuery(`members/`))
            .send({members: [member]})
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;
                should.exist(jsonResponse);
                should.exist(jsonResponse.members);
                jsonResponse.members.should.have.length(1);

                return jsonResponse.members[0];
            });

        await request.delete(localUtils.API.getApiQuery(`members/${createdMember.id}/?cancel=false`))
            .set('Origin', config.get('url'))
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(204)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);

                const jsonResponse = res.body;

                should.exist(jsonResponse);
            });
    });

    it('Can import CSV with minimum one field and labels', function () {
        let importLabel;

        return request
            .post(localUtils.API.getApiQuery(`members/upload/`))
            .field('labels', ['global-label-1', 'global-label-1'])
            .attach('membersfile', path.join(__dirname, '/../../../../utils/fixtures/csv/valid-members-labels.csv'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.meta);
                should.exist(jsonResponse.meta.stats);

                should.exist(jsonResponse.meta.import_label);

                jsonResponse.meta.stats.imported.count.should.equal(2);
                jsonResponse.meta.stats.invalid.count.should.equal(0);

                importLabel = jsonResponse.meta.import_label.slug;
                return request
                    .get(localUtils.API.getApiQuery(`members/?&filter=label:${importLabel}`))
                    .set('Origin', config.get('url'))
                    .expect('Content-Type', /json/)
                    .expect('Cache-Control', testUtils.cacheRules.private)
                    .expect(200);
            })
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.members);
                should.equal(jsonResponse.members.length, 2);

                const importedMember1 = jsonResponse.members.find(m => m.email === 'member+labels_1@example.com');
                should.exist(importedMember1);
                should(importedMember1.name).equal(null);
                should(importedMember1.note).equal(null);
                importedMember1.subscribed.should.equal(true);
                importedMember1.comped.should.equal(false);
                importedMember1.stripe.should.not.be.undefined();
                importedMember1.stripe.subscriptions.length.should.equal(0);

                // check label order
                // 1 unique global + 1 record labels + auto-generated import label
                importedMember1.labels.length.should.equal(3);
                importedMember1.labels[0].slug.should.equal('label');
                importedMember1.labels[1].slug.should.equal('global-label-1');
                importedMember1.labels[2].slug.should.equal(importLabel);

                const importedMember2 = jsonResponse.members.find(m => m.email === 'member+labels_2@example.com');
                should.exist(importedMember2);
                // 1 unique global + 2 record labels + auto-generated import label
                importedMember2.labels.length.should.equal(4);
                importedMember2.labels[0].slug.should.equal('another-label');
                importedMember2.labels[1].slug.should.equal('and-one-more');
                importedMember2.labels[2].slug.should.equal('global-label-1');
                importedMember2.labels[3].slug.should.equal(importLabel);
            });
    });

    it('Can import CSV with mapped fields', function () {
        return request
            .post(localUtils.API.getApiQuery(`members/upload/`))
            .field('mapping[email]', 'correo_electrpnico')
            .field('mapping[name]', 'nombre')
            .attach('membersfile', path.join(__dirname, '/../../../../utils/fixtures/csv/members-with-mappings.csv'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.meta);
                should.exist(jsonResponse.meta.stats);

                jsonResponse.meta.stats.imported.count.should.equal(1);
                jsonResponse.meta.stats.invalid.count.should.equal(0);
            })
            .then(() => {
                return request
                    .get(localUtils.API.getApiQuery(`members/?search=${encodeURIComponent('member+mapped_1@example.com')}`))
                    .set('Origin', config.get('url'))
                    .expect('Content-Type', /json/)
                    .expect('Cache-Control', testUtils.cacheRules.private)
                    .expect(200);
            })
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.members);
                should.exist(jsonResponse.members[0]);

                const importedMember1 = jsonResponse.members[0];
                should(importedMember1.email).equal('member+mapped_1@example.com');
                should(importedMember1.name).equal('Hannah');
                should(importedMember1.note).equal('no need to map me');
                importedMember1.subscribed.should.equal(true);
                importedMember1.comped.should.equal(false);
                importedMember1.stripe.should.not.be.undefined();
                importedMember1.stripe.subscriptions.length.should.equal(0);
                importedMember1.labels.length.should.equal(1); // auto-generated import label
            });
    });

    it('Can import CSV with labels and provide additional labels', function () {
        return request
            .post(localUtils.API.getApiQuery(`members/upload/`))
            .attach('membersfile', path.join(__dirname, '/../../../../utils/fixtures/csv/valid-members-defaults.csv'))

            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.meta);
                should.exist(jsonResponse.meta.stats);

                jsonResponse.meta.stats.imported.count.should.equal(2);
                jsonResponse.meta.stats.invalid.count.should.equal(0);
            })
            .then(() => {
                return request
                    .get(localUtils.API.getApiQuery(`members/`))
                    .set('Origin', config.get('url'))
                    .expect('Content-Type', /json/)
                    .expect('Cache-Control', testUtils.cacheRules.private)
                    .expect(200);
            })
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.members);

                const defaultMember1 = jsonResponse.members.find(member => (member.email === 'member+defaults_1@example.com'));
                should(defaultMember1.name).equal(null);
                should(defaultMember1.note).equal(null);
                defaultMember1.subscribed.should.equal(true);
                defaultMember1.comped.should.equal(false);
                defaultMember1.stripe.should.not.be.undefined();
                defaultMember1.stripe.subscriptions.length.should.equal(0);
                defaultMember1.labels.length.should.equal(1); // auto-generated import label

                const defaultMember2 = jsonResponse.members.find(member => (member.email === 'member+defaults_2@example.com'));
                should(defaultMember2).not.be.undefined();
            });
    });

    it('Fails to import members with stripe_customer_id', function () {
        return request
            .post(localUtils.API.getApiQuery(`members/upload/`))
            .attach('membersfile', path.join(__dirname, '/../../../../utils/fixtures/csv/members-with-stripe-ids.csv'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.meta);
                should.exist(jsonResponse.meta.stats);

                jsonResponse.meta.stats.imported.count.should.equal(0);
                jsonResponse.meta.stats.invalid.count.should.equal(2);

                should.equal(jsonResponse.meta.stats.invalid.errors.length, 1);
                jsonResponse.meta.stats.invalid.errors[0].message.should.equal('Missing Stripe connection');

                should.not.exist(jsonResponse.meta.import_label);
            });
    });

    it('Fails to import memmber with invalid values', function () {
        return request
            .post(localUtils.API.getApiQuery(`members/upload/`))
            .attach('membersfile', path.join(__dirname, '/../../../../utils/fixtures/csv/members-invalid-values.csv'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.meta);
                should.exist(jsonResponse.meta.stats);

                jsonResponse.meta.stats.imported.count.should.equal(0);
                jsonResponse.meta.stats.invalid.count.should.equal(2);

                should.equal(jsonResponse.meta.stats.invalid.errors.length, 4);
                jsonResponse.meta.stats.invalid.errors[0].message.should.equal('Validation failed for \'name\'');
                jsonResponse.meta.stats.invalid.errors[0].count.should.equal(1);

                jsonResponse.meta.stats.invalid.errors[1].message.should.equal('Validation failed for \'email\'');
                jsonResponse.meta.stats.invalid.errors[1].count.should.equal(2);

                jsonResponse.meta.stats.invalid.errors[2].message.should.equal('Validation failed for \'created_at\'');
                jsonResponse.meta.stats.invalid.errors[2].count.should.equal(1);

                jsonResponse.meta.stats.invalid.errors[3].message.should.equal('Validation failed for \'complimentary_plan\'');
                jsonResponse.meta.stats.invalid.errors[3].count.should.equal(1);

                should.not.exist(jsonResponse.meta.import_label);
            });
    });

    it('Fails to import memmber duplicate emails', function () {
        return request
            .post(localUtils.API.getApiQuery(`members/upload/`))
            .attach('membersfile', path.join(__dirname, '/../../../../utils/fixtures/csv/members-duplicate-emails.csv'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(201)
            .then((res) => {
                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.meta);
                should.exist(jsonResponse.meta.stats);

                jsonResponse.meta.stats.imported.count.should.equal(1);
                jsonResponse.meta.stats.invalid.count.should.equal(1);

                should.equal(jsonResponse.meta.stats.invalid.errors.length, 1);
                jsonResponse.meta.stats.invalid.errors[0].message.should.equal('Member already exists');
                jsonResponse.meta.stats.invalid.errors[0].count.should.equal(1);

                should.exist(jsonResponse.meta.import_label);
            });
    });

    it('Can fetch stats with no ?days param', function () {
        return request
            .get(localUtils.API.getApiQuery('members/stats/'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            // .expect(200) - doesn't surface underlying errors in tests
            .then((res) => {
                res.status.should.equal(200, JSON.stringify(res.body));

                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.total);
                should.exist(jsonResponse.total_in_range);
                should.exist(jsonResponse.total_on_date);
                should.exist(jsonResponse.new_today);

                // 3 from fixtures and 6 imported in previous tests
                jsonResponse.total.should.equal(9);
            });
    });

    it('Can fetch stats with ?days=90', function () {
        return request
            .get(localUtils.API.getApiQuery('members/stats/?days=90'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            // .expect(200) - doesn't surface underlying errors in tests
            .then((res) => {
                res.status.should.equal(200, JSON.stringify(res.body));

                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.total);
                should.exist(jsonResponse.total_in_range);
                should.exist(jsonResponse.total_on_date);
                should.exist(jsonResponse.new_today);

                // 3 from fixtures and 6 imported in previous tests
                jsonResponse.total.should.equal(9);
            });
    });

    it('Can fetch stats with ?days=all-time', function () {
        return request
            .get(localUtils.API.getApiQuery('members/stats/?days=all-time'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            // .expect(200) - doesn't surface underlying errors in tests
            .then((res) => {
                res.status.should.equal(200, JSON.stringify(res.body));

                should.not.exist(res.headers['x-cache-invalidate']);
                const jsonResponse = res.body;

                should.exist(jsonResponse);
                should.exist(jsonResponse.total);
                should.exist(jsonResponse.total_in_range);
                should.exist(jsonResponse.total_on_date);
                should.exist(jsonResponse.new_today);

                // 3 from fixtures and 6 imported in previous tests
                jsonResponse.total.should.equal(9);
            });
    });

    it('Errors when fetching stats with unknown days param value', function () {
        return request
            .get(localUtils.API.getApiQuery('members/stats/?days=nope'))
            .set('Origin', config.get('url'))
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(422);
    });
});
