-- Reference data every environment needs: the permission catalogue and the
-- built-in roles (organization_id null) that every organization shares.
-- Organizations can add their own roles alongside these.

INSERT INTO "permissions" ("key", "description") VALUES
  ('organization.read',   'View organization details'),
  ('organization.update', 'Change organization settings'),
  ('members.read',        'View people in the organization'),
  ('members.invite',      'Invite people'),
  ('members.remove',      'Remove people'),
  ('roles.manage',        'Create roles and assign them'),
  ('groups.manage',       'Create groups and change their members'),
  ('collections.manage',  'Create collections and change who can access them'),
  ('documents.read',      'Read documents the person has access to'),
  ('documents.create',    'Upload documents'),
  ('documents.update',    'Replace documents and edit their details'),
  ('documents.delete',    'Remove documents'),
  ('templates.manage',    'Create and approve generation templates'),
  ('documents.generate',  'Draft documents from approved templates'),
  ('chat.create',         'Start chats'),
  ('chat.read',           'Read chats shared with the person'),
  ('audit.read',          'Read the audit log');

INSERT INTO "roles" ("organization_id", "name", "description", "is_system") VALUES
  (NULL, 'Owner',  'Billing and ownership, plus everything an admin can do.', true),
  (NULL, 'Admin',  'Manages people, groups and all documents. Sees everything.', true),
  (NULL, 'Member', 'Asks, drafts and reviews using the documents their groups can see.', true),
  (NULL, 'Viewer', 'Reads documents and asks questions, but cannot change anything.', true);

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON
  CASE r."name"
    WHEN 'Owner'  THEN true
    WHEN 'Admin'  THEN p."key" <> 'organization.update'
    WHEN 'Member' THEN p."key" IN ('organization.read', 'members.read', 'documents.read', 'documents.create',
                                   'documents.generate', 'chat.create', 'chat.read')
    WHEN 'Viewer' THEN p."key" IN ('organization.read', 'members.read', 'documents.read', 'chat.create', 'chat.read')
  END
WHERE r."organization_id" IS NULL;
