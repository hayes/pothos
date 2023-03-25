CREATE MIGRATION m1co7oxdqc52kxete3rozfhbkb67kofxnqspppu7ek6pe327a5mtyq
    ONTO initial
{
  CREATE TYPE default::Post {
      CREATE REQUIRED PROPERTY big_int_id -> std::bigint {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY content -> std::str;
      CREATE REQUIRED PROPERTY created_at -> std::datetime {
          SET default := (std::datetime_current());
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED PROPERTY published -> std::bool;
      CREATE REQUIRED PROPERTY title -> std::str;
      CREATE REQUIRED PROPERTY updated_at -> std::datetime;
  };
};
