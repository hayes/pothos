import type { Prisma, Post, Comment, Profile, User, Unrelated } from "@prisma/client";
export default interface PrismaTypes {
    Post: {
        Shape: Post;
        Include: Prisma.PostInclude;
        Where: Prisma.PostWhereUniqueInput;
        Fields: "author" | "comments";
        ListRelations: "comments";
        Relations: {
            author: {
                Shape: User;
                Types: PrismaTypes["User"];
            };
            comments: {
                Shape: Comment[];
                Types: PrismaTypes["Comment"];
            };
        };
    };
    Comment: {
        Shape: Comment;
        Include: Prisma.CommentInclude;
        Where: Prisma.CommentWhereUniqueInput;
        Fields: "author" | "post";
        ListRelations: never;
        Relations: {
            author: {
                Shape: User;
                Types: PrismaTypes["User"];
            };
            post: {
                Shape: Post;
                Types: PrismaTypes["Post"];
            };
        };
    };
    Profile: {
        Shape: Profile;
        Include: Prisma.ProfileInclude;
        Where: Prisma.ProfileWhereUniqueInput;
        Fields: "user";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Types: PrismaTypes["User"];
            };
        };
    };
    User: {
        Shape: User;
        Include: Prisma.UserInclude;
        Where: Prisma.UserWhereUniqueInput;
        Fields: "posts" | "comments" | "profile";
        ListRelations: "posts" | "comments";
        Relations: {
            posts: {
                Shape: Post[];
                Types: PrismaTypes["Post"];
            };
            comments: {
                Shape: Comment[];
                Types: PrismaTypes["Comment"];
            };
            profile: {
                Shape: Profile | null;
                Types: PrismaTypes["Profile"];
            };
        };
    };
    Unrelated: {
        Shape: Unrelated;
        Include: never;
        Where: Prisma.UnrelatedWhereUniqueInput;
        Fields: never;
        ListRelations: never;
        Relations: {};
    };
}