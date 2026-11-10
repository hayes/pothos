import type { Prisma, Post, Media, PostMedia, Comment, Profile, User, Follow, Unrelated, WithID, WithUnique, WithCompositeID, WithCompositeUnique, FindUniqueRelations } from "../tests/client/client.js";
import type { PothosPrismaDatamodel } from "../src";
export default interface PrismaTypes {
    Post: {
        Name: "Post";
        Shape: Post;
        Include: Prisma.PostInclude;
        Select: Prisma.PostSelect;
        OrderBy: Prisma.PostOrderByWithRelationInput;
        WhereUnique: Prisma.PostWhereUniqueInput;
        Where: Prisma.PostWhereInput;
        Create: {};
        Update: {};
        RelationName: "author" | "comments" | "media";
        ListRelations: "comments" | "media";
        Relations: {
            author: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            comments: {
                Shape: Comment[];
                Name: "Comment";
                Nullable: false;
            };
            media: {
                Shape: PostMedia[];
                Name: "PostMedia";
                Nullable: false;
            };
        };
    };
    Media: {
        Name: "Media";
        Shape: Media;
        Include: Prisma.MediaInclude;
        Select: Prisma.MediaSelect;
        OrderBy: Prisma.MediaOrderByWithRelationInput;
        WhereUnique: Prisma.MediaWhereUniqueInput;
        Where: Prisma.MediaWhereInput;
        Create: {};
        Update: {};
        RelationName: "posts" | "uploadedBy";
        ListRelations: "posts";
        Relations: {
            posts: {
                Shape: PostMedia[];
                Name: "PostMedia";
                Nullable: false;
            };
            uploadedBy: {
                Shape: User | null;
                Name: "User";
                Nullable: true;
            };
        };
    };
    PostMedia: {
        Name: "PostMedia";
        Shape: PostMedia;
        Include: Prisma.PostMediaInclude;
        Select: Prisma.PostMediaSelect;
        OrderBy: Prisma.PostMediaOrderByWithRelationInput;
        WhereUnique: Prisma.PostMediaWhereUniqueInput;
        Where: Prisma.PostMediaWhereInput;
        Create: {};
        Update: {};
        RelationName: "post" | "media";
        ListRelations: never;
        Relations: {
            post: {
                Shape: Post;
                Name: "Post";
                Nullable: false;
            };
            media: {
                Shape: Media;
                Name: "Media";
                Nullable: false;
            };
        };
    };
    Comment: {
        Name: "Comment";
        Shape: Comment;
        Include: Prisma.CommentInclude;
        Select: Prisma.CommentSelect;
        OrderBy: Prisma.CommentOrderByWithRelationInput;
        WhereUnique: Prisma.CommentWhereUniqueInput;
        Where: Prisma.CommentWhereInput;
        Create: {};
        Update: {};
        RelationName: "author" | "post";
        ListRelations: never;
        Relations: {
            author: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            post: {
                Shape: Post;
                Name: "Post";
                Nullable: false;
            };
        };
    };
    Profile: {
        Name: "Profile";
        Shape: Profile;
        Include: Prisma.ProfileInclude;
        Select: Prisma.ProfileSelect;
        OrderBy: Prisma.ProfileOrderByWithRelationInput;
        WhereUnique: Prisma.ProfileWhereUniqueInput;
        Where: Prisma.ProfileWhereInput;
        Create: {};
        Update: {};
        RelationName: "user";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
        };
    };
    User: {
        Name: "User";
        Shape: User;
        Include: Prisma.UserInclude;
        Select: Prisma.UserSelect;
        OrderBy: Prisma.UserOrderByWithRelationInput;
        WhereUnique: Prisma.UserWhereUniqueInput;
        Where: Prisma.UserWhereInput;
        Create: {};
        Update: {};
        RelationName: "posts" | "comments" | "profile" | "followers" | "following" | "Media";
        ListRelations: "posts" | "comments" | "followers" | "following" | "Media";
        Relations: {
            posts: {
                Shape: Post[];
                Name: "Post";
                Nullable: false;
            };
            comments: {
                Shape: Comment[];
                Name: "Comment";
                Nullable: false;
            };
            profile: {
                Shape: Profile | null;
                Name: "Profile";
                Nullable: true;
            };
            followers: {
                Shape: Follow[];
                Name: "Follow";
                Nullable: false;
            };
            following: {
                Shape: Follow[];
                Name: "Follow";
                Nullable: false;
            };
            Media: {
                Shape: Media[];
                Name: "Media";
                Nullable: false;
            };
        };
    };
    Follow: {
        Name: "Follow";
        Shape: Follow;
        Include: Prisma.FollowInclude;
        Select: Prisma.FollowSelect;
        OrderBy: Prisma.FollowOrderByWithRelationInput;
        WhereUnique: Prisma.FollowWhereUniqueInput;
        Where: Prisma.FollowWhereInput;
        Create: {};
        Update: {};
        RelationName: "from" | "to";
        ListRelations: never;
        Relations: {
            from: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
            to: {
                Shape: User;
                Name: "User";
                Nullable: false;
            };
        };
    };
    Unrelated: {
        Name: "Unrelated";
        Shape: Unrelated;
        Include: never;
        Select: Prisma.UnrelatedSelect;
        OrderBy: Prisma.UnrelatedOrderByWithRelationInput;
        WhereUnique: Prisma.UnrelatedWhereUniqueInput;
        Where: Prisma.UnrelatedWhereInput;
        Create: {};
        Update: {};
        RelationName: never;
        ListRelations: never;
        Relations: {};
    };
    WithID: {
        Name: "WithID";
        Shape: WithID;
        Include: Prisma.WithIDInclude;
        Select: Prisma.WithIDSelect;
        OrderBy: Prisma.WithIDOrderByWithRelationInput;
        WhereUnique: Prisma.WithIDWhereUniqueInput;
        Where: Prisma.WithIDWhereInput;
        Create: {};
        Update: {};
        RelationName: "FindUniqueRelations";
        ListRelations: "FindUniqueRelations";
        Relations: {
            FindUniqueRelations: {
                Shape: FindUniqueRelations[];
                Name: "FindUniqueRelations";
                Nullable: false;
            };
        };
    };
    WithUnique: {
        Name: "WithUnique";
        Shape: WithUnique;
        Include: Prisma.WithUniqueInclude;
        Select: Prisma.WithUniqueSelect;
        OrderBy: Prisma.WithUniqueOrderByWithRelationInput;
        WhereUnique: Prisma.WithUniqueWhereUniqueInput;
        Where: Prisma.WithUniqueWhereInput;
        Create: {};
        Update: {};
        RelationName: "FindUniqueRelations";
        ListRelations: "FindUniqueRelations";
        Relations: {
            FindUniqueRelations: {
                Shape: FindUniqueRelations[];
                Name: "FindUniqueRelations";
                Nullable: false;
            };
        };
    };
    WithCompositeID: {
        Name: "WithCompositeID";
        Shape: WithCompositeID;
        Include: Prisma.WithCompositeIDInclude;
        Select: Prisma.WithCompositeIDSelect;
        OrderBy: Prisma.WithCompositeIDOrderByWithRelationInput;
        WhereUnique: Prisma.WithCompositeIDWhereUniqueInput;
        Where: Prisma.WithCompositeIDWhereInput;
        Create: {};
        Update: {};
        RelationName: "FindUniqueRelations";
        ListRelations: "FindUniqueRelations";
        Relations: {
            FindUniqueRelations: {
                Shape: FindUniqueRelations[];
                Name: "FindUniqueRelations";
                Nullable: false;
            };
        };
    };
    WithCompositeUnique: {
        Name: "WithCompositeUnique";
        Shape: WithCompositeUnique;
        Include: Prisma.WithCompositeUniqueInclude;
        Select: Prisma.WithCompositeUniqueSelect;
        OrderBy: Prisma.WithCompositeUniqueOrderByWithRelationInput;
        WhereUnique: Prisma.WithCompositeUniqueWhereUniqueInput;
        Where: Prisma.WithCompositeUniqueWhereInput;
        Create: {};
        Update: {};
        RelationName: "FindUniqueRelations";
        ListRelations: "FindUniqueRelations";
        Relations: {
            FindUniqueRelations: {
                Shape: FindUniqueRelations[];
                Name: "FindUniqueRelations";
                Nullable: false;
            };
        };
    };
    FindUniqueRelations: {
        Name: "FindUniqueRelations";
        Shape: FindUniqueRelations;
        Include: Prisma.FindUniqueRelationsInclude;
        Select: Prisma.FindUniqueRelationsSelect;
        OrderBy: Prisma.FindUniqueRelationsOrderByWithRelationInput;
        WhereUnique: Prisma.FindUniqueRelationsWhereUniqueInput;
        Where: Prisma.FindUniqueRelationsWhereInput;
        Create: {};
        Update: {};
        RelationName: "withID" | "withUnique" | "withCompositeID" | "withCompositeUnique";
        ListRelations: never;
        Relations: {
            withID: {
                Shape: WithID;
                Name: "WithID";
                Nullable: false;
            };
            withUnique: {
                Shape: WithUnique;
                Name: "WithUnique";
                Nullable: false;
            };
            withCompositeID: {
                Shape: WithCompositeID;
                Name: "WithCompositeID";
                Nullable: false;
            };
            withCompositeUnique: {
                Shape: WithCompositeUnique;
                Name: "WithCompositeUnique";
                Nullable: false;
            };
        };
    };
}
export declare function getDatamodel(): PothosPrismaDatamodel;
