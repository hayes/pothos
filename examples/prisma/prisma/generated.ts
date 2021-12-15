import type { Prisma, User, Post, Comment } from "@prisma/client";
export default interface PrismaTypes {
    User: {
        Shape: User;
        Include: Prisma.UserInclude;
        Where: Prisma.UserWhereUniqueInput;
        Fields: "posts" | "comments";
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
        };
    };
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
}