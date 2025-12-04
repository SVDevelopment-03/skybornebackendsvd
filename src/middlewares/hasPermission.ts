import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../handlers/httpError.handler";

export const routePermissions: Record<string, string[]> = {
  "/meetings/create": ["admin"],
};


export const verifyPermission = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const currentPath = req.path;

    // If route not in permissions map, allow access (backward compatibility)
    if (!routePermissions[currentPath]) {
      return next();
    }

    // User must be authenticated (verifyAccessToken should be called before)
    if (!req.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    // Get allowed roles for this route
    const allowedRoles = routePermissions[currentPath];
    console.log("AAA", allowedRoles,req.user);
    

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `You don't have permission to access this resource. Required roles: ${allowedRoles.join(", ")}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to check if a user has a specific role
 */
export const hasRole = (userRole: string, allowedRoles: string[]): boolean => {
  return allowedRoles.includes(userRole);
};

/**
 * Helper function to add/update route permissions
 */
export const addRoutePermission = (
  path: string,
  roles: string[]
): void => {
  routePermissions[path] = roles;
};

/**
 * Helper function to get permissions for a specific route
 */
export const getRoutePermission = (path: string): string[] | undefined => {
  return routePermissions[path];
};

/**
 * Helper function to add a role to existing route permissions
 */
export const addRoleToRoute = (path: string, role: string): void => {
  if (routePermissions[path]) {
    if (!routePermissions[path].includes(role)) {
      routePermissions[path].push(role);
    }
  }
};