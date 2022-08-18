module default {
    type Post {
        required property big_int_id -> bigint {
            constraint exclusive;
        };
        required property created_at -> datetime {
            default := datetime_current();
            constraint exclusive;
            readonly := true;
        };
        required property updated_at -> datetime;

        required property title -> str;
        property content -> str;
        required property published -> bool;

        link author -> User;
    }

    type Media {
        required property url -> str;
        multi link posts -> PostMedia;
        link uploaded_by -> User;
    }

    type PostMedia {
        required link post -> Post;
        required link media -> Media;
    }

    type Comment {
        required property created_at -> datetime {
            default := datetime_current();
            constraint exclusive;
            readonly := true;
        };
        required property content -> str;
        required link author -> User;
        required link post -> Post;
    }

    type Profile {
        property bio -> str;
        required link user -> User;
    }

    type User {
        required property email -> str {
            constraint exclusive;
        };
        property name -> str;
        multi link posts -> Post;
        multi link comments -> Comment;
        link profile -> Profile;
        multi link followers -> Follow;
        multi link following -> Follow;
        multi link media -> Media;
    }

    type Follow {
        required link from_user -> User;
        required link to_user -> User;
    }
}
