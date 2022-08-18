CREATE MIGRATION m1goni6inys6wt4wokvqvemtqiiambmkfxudnf6rsculrh645bozla
    ONTO m1co7oxdqc52kxete3rozfhbkb67kofxnqspppu7ek6pe327a5mtyq
{
  CREATE TYPE default::Comment {
      CREATE REQUIRED LINK post -> default::Post;
      CREATE REQUIRED PROPERTY content -> std::str;
      CREATE REQUIRED PROPERTY created_at -> std::datetime {
          SET default := (std::datetime_current());
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE default::User {
      CREATE MULTI LINK comments -> default::Comment;
      CREATE MULTI LINK posts -> default::Post;
      CREATE REQUIRED PROPERTY email -> std::str {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY name -> std::str;
  };
  ALTER TYPE default::Comment {
      CREATE REQUIRED LINK author -> default::User;
  };
  CREATE TYPE default::Follow {
      CREATE REQUIRED LINK from_user -> default::User;
      CREATE REQUIRED LINK to_user -> default::User;
  };
  ALTER TYPE default::User {
      CREATE MULTI LINK followers -> default::Follow;
      CREATE MULTI LINK following -> default::Follow;
  };
  CREATE TYPE default::Media {
      CREATE LINK uploaded_by -> default::User;
      CREATE REQUIRED PROPERTY url -> std::str;
  };
  CREATE TYPE default::PostMedia {
      CREATE REQUIRED LINK media -> default::Media;
      CREATE REQUIRED LINK post -> default::Post;
  };
  ALTER TYPE default::Media {
      CREATE MULTI LINK posts -> default::PostMedia;
  };
  ALTER TYPE default::User {
      CREATE MULTI LINK media -> default::Media;
  };
  ALTER TYPE default::Post {
      CREATE LINK author -> default::User;
  };
  CREATE TYPE default::Profile {
      CREATE REQUIRED LINK user -> default::User;
      CREATE PROPERTY bio -> std::str;
  };
  ALTER TYPE default::User {
      CREATE LINK profile -> default::Profile;
  };
};
