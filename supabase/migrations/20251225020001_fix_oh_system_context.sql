-- Fix OH System endeavors with null context_id and created_by
-- Using explicit ID list since user_id may also be null

UPDATE endeavors
SET
  context_id = 'context:fc249f8a-92d1-46b7-855f-eb39285e774b:1758641268850',
  created_by = 'fc249f8a-92d1-46b7-855f-eb39285e774b'::uuid,
  user_id = 'fc249f8a-92d1-46b7-855f-eb39285e774b'::uuid
WHERE id IN (
  '597d274c-c4c2-401c-aab8-d4822dbd20e1',
  '8b35ec58-b111-4d7a-833d-e645711d7f21',
  'a653ef1e-1d80-4849-a10c-fc3583d6e816',
  '80cfe76a-d241-4676-aea9-ac351e027567',
  'aaa7cf11-ecc5-4059-ab0c-02754d22d626',
  'dc7ffa40-d426-476d-b6f9-cdfe15849167',
  '6d21204b-e725-42ac-8021-310c9aba1b25',
  '7e1c8200-32ea-4653-a268-19ee170c17df',
  '634f6fc1-a58c-4703-9877-79c9e53ca324',
  'bd5d0eb3-540b-4b16-84ff-b933e2dfa6a8',
  'e53d33b4-3268-4aa1-8899-23b048f06ef2',
  '43693b5c-4294-4655-bd92-7ae74e351a36',
  '2433b43f-ec8b-45ca-8631-bc7bd7161d13',
  '91765be0-c287-4fe0-bb5e-23a2467b9cc3',
  '672a5c48-d59f-4be9-9c85-664a86984df1',
  '6599a317-84b2-4410-a89a-a0f761df7fab',
  'd2d33a09-2cb1-404c-aa02-dbcb3a2f867a',
  'fe1db50a-03a4-4c9f-bbd5-fcc2cde62ea6',
  'e4f39ee0-569b-4c06-86ff-d5a707237d32',
  '6eefcf9b-881b-4aba-8948-b4d462a1505e',
  '8df3009e-acfb-450d-ab20-050b4199d6d6',
  'cb97c829-a774-4fb9-ab93-eaf9a21a3bb0',
  'bc4a860b-e7ef-4edc-b218-9e1e0fd92680'
);
